const apiClient = require('../../api/client');
const ApiClient = require('../../api/client'); // Import the class
const endpoints = require('../../api/endpoints');
const InvoiceModel = require('./invoice.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');
const db = require('../../db');
const config = require('../../config');

class InvoiceService {
  constructor() {
    // Default agreement number from config
    this.defaultAgreementNumber = config.api.agreementNumber;
  }
  
  async initializeAgreementNumber() {
    return this.defaultAgreementNumber;
  }
  
  // Get all active agreements
  async getActiveAgreements() {
    try {
      return await AgreementModel.getAll(true);
    } catch (error) {
      logger.error('Error getting active agreements:', error.message);
      throw error;
    }
  }
  
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API invoice data to our database model
  transformInvoiceData(invoice, type, agreementNumber) {
    // Extract customer name from invoice data
    const customerName = invoice.customer?.name || 
                        invoice.recipient?.name || 
                        'Unknown Customer';
    
    // Extract customer number from invoice data
    const customerNumber = invoice.customer?.customerNumber || null;
    
    // Base transformed data object
    const transformed = {
      customer_number: customerNumber,
      customer_name: customerName,
      agreement_number: agreementNumber,
      currency: invoice.currency,
      exchange_rate: invoice.exchangeRate,
      date: invoice.date,
      due_date: invoice.dueDate,
      net_amount: invoice.netAmount,
      gross_amount: invoice.grossAmount,
      vat_amount: invoice.vatAmount,
      data: invoice // Store the full API response
    };
    
    // Set payment status based on type (no invoice_type stored)
    let paymentStatus;
    if (type === 'draft') {
      paymentStatus = 'pending';
      transformed.draft_invoice_number = invoice.draftInvoiceNumber;
    } else if (type === 'booked') {
      paymentStatus = 'pending';
    } else if (type === 'paid') {
      paymentStatus = 'paid';
    } else if (type === 'unpaid') {
      paymentStatus = 'pending';
    } else if (type === 'overdue') {
      paymentStatus = 'overdue';
    } else if (type === 'not-due') {
      paymentStatus = 'pending';
    }
    
    transformed.payment_status = paymentStatus;
    
    // Set invoice number
    const invoiceNumber = invoice.bookedInvoiceNumber || invoice.draftInvoiceNumber;
    if (invoiceNumber) {
      transformed.invoice_number = invoiceNumber;
    }
    
    // Extract any notes from the invoice
    if (invoice.notes) {
      transformed.notes = [
        invoice.notes.heading,
        invoice.notes.textLine1,
        invoice.notes.textLine2
      ].filter(Boolean).join(' - ');
    }
    
    // Extract reference if available
    if (invoice.references && invoice.references.other) {
      transformed.reference_number = invoice.references.other;
    }
    
    // Add remainder amount (for unpaid invoices)
    if (invoice.remainder) {
      transformed.remainder = invoice.remainder;
    }

    return transformed;
  }
  
  // Transform invoice lines
  transformInvoiceLines(invoice, invoiceId) {
    if (!invoice.lines || !Array.isArray(invoice.lines)) {
      return [];
    }
    
    return invoice.lines.map((line, index) => ({
      invoice_id: invoiceId,
      line_number: index + 1,
      product_number: line.product?.productNumber,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      discount_percentage: line.discountPercentage,
      unit: line.unit,
      total_net_amount: line.totalNetAmount,
      data: line
    }));
  }
  
  // Sync invoices for a specific agreement
  async syncAgreementInvoices(agreement, types = ['draft', 'booked', 'paid', 'unpaid', 'overdue', 'not-due']) {
    const startTime = new Date();
    const results = {};
    let totalCount = 0;
    
    try {
      logger.info(`Starting sync for agreement ${agreement.name} (${agreement.agreement_number || 'Unknown'})`);
      
      // Create client for this agreement
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      
      // Get the agreement number directly from the API to confirm
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      const companyName = agreementInfo.companyName || agreement.name;
      
      let needsUpdate = false;
      let updateData = {};
      
      // Check if agreement number needs update
      if (!agreement.agreement_number || agreement.agreement_number !== agreementNumber) {
        logger.warn(`Agreement number mismatch: stored=${agreement.agreement_number || 'null'}, API=${agreementNumber}`);
        needsUpdate = true;
        updateData.agreement_number = agreementNumber;
      }
      
      // Check if company name needs update
      if (companyName && companyName !== 'Unknown' && companyName !== agreement.name) {
        logger.warn(`Agreement name mismatch: stored=${agreement.name}, API=${companyName}`);
        needsUpdate = true;
        updateData.name = companyName;
      }
      
      // Update the agreement if needed
      if (needsUpdate) {
        await AgreementModel.update(agreement.id, updateData);
        
        // Update local object with new values
        if (updateData.agreement_number) {
          agreement.agreement_number = updateData.agreement_number;
        }
        if (updateData.name) {
          agreement.name = updateData.name;
        }
        
        logger.info(`Updated agreement data for ${agreement.id}: ${JSON.stringify(updateData)}`);
      }
      
      // Sync each selected type
      for (const type of types) {
        try {
          let endpoint;
          switch (type) {
            case 'draft': endpoint = endpoints.INVOICES_DRAFTS; break;
            case 'booked': endpoint = endpoints.INVOICES_BOOKED; break;
            case 'paid': endpoint = endpoints.INVOICES_PAID; break;
            case 'unpaid': endpoint = endpoints.INVOICES_UNPAID; break;
            case 'overdue': endpoint = endpoints.INVOICES_OVERDUE; break;
            case 'not-due': endpoint = endpoints.INVOICES_NOT_DUE; break;
            default: continue; // Skip unknown types
          }
          
          // Fetch invoices of this type
          const invoices = await client.getPaginated(endpoint);
          logger.info(`Found ${invoices.length} ${type} invoices for agreement ${agreementNumber}`);
          
          let recordCount = 0;
          
          // Process each invoice
          for (const invoice of invoices) {
            // Transform API data to our model
            const invoiceData = this.transformInvoiceData(invoice, type, agreementNumber);
            
            // Smart upsert the invoice
            const savedInvoice = await InvoiceModel.smartUpsert(invoiceData);
            
            // Process invoice lines if available
            if (invoice.lines) {
              const lines = this.transformInvoiceLines(invoice, savedInvoice.id);
              await InvoiceModel.saveInvoiceLines(savedInvoice.id, lines);
            }
            
            recordCount++;
          }
          
          // Record successful sync
          await InvoiceModel.recordSyncLog(
            `invoices_${type}`,
            'sync',
            'success',
            recordCount,
            null,
            startTime
          );
          
          // Add to results
          results[type] = {
            status: 'success',
            type,
            count: recordCount
          };
          
          totalCount += recordCount;
          
        } catch (error) {
          logger.error(`Error syncing ${type} invoices for agreement ${agreementNumber}:`, error.message);
          
          // Record failed sync
          await InvoiceModel.recordSyncLog(
            `invoices_${type}`,
            'sync',
            'error',
            0,
            error.message,
            startTime
          );
          
          // Add to results
          results[type] = {
            status: 'error',
            type,
            error: error.message
          };
        }
      }
      
      logger.info(`Sync completed for agreement ${agreementNumber}: ${totalCount} invoices processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        results,
        totalCount
      };
      
    } catch (error) {
      logger.error(`Error syncing invoices for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_agreement',
        'sync',
        'error',
        0,
        error.message,
        startTime
      );
      
      throw error;
    }
  }
  
  // Sync all invoices across all agreements
  async syncAllInvoices() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of all invoices across all agreements');
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          results: [],
          totalCount: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing agreement ${agreement.name}:`, error.message);
          agreementResults.push({
            agreement: {
              id: agreement.id,
              name: agreement.name,
              agreement_number: agreement.agreement_number
            },
            status: 'error',
            error: error.message
          });
        }
      }
      
      // Record overall sync result
      await InvoiceModel.recordSyncLog(
        'invoices_all_agreements',
        'sync',
        'success',
        totalCount,
        null,
        startTime
      );
      
      logger.info(`Completed sync across all agreements: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall sync process:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_all_agreements',
        'sync',
        'error',
        totalCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }
  
  // Sync invoices for a specific agreement by ID
  async syncInvoicesByAgreementId(agreementId) {
    try {
      const agreement = await AgreementModel.getById(agreementId);
      return await this.syncAgreementInvoices(agreement);
    } catch (error) {
      logger.error(`Error syncing invoices for agreement ID ${agreementId}:`, error.message);
      throw error;
    }
  }
  
  // The following methods maintain backward compatibility
  
  // Sync draft invoices only
  async syncDraftInvoices() {
    try {
      logger.info('Starting sync of draft invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'draft',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['draft']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing draft invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of draft invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'draft',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing draft invoices:', error.message);
      throw error;
    }
  }
  
  // Sync booked invoices only
  async syncBookedInvoices() {
    try {
      logger.info('Starting sync of booked invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'booked',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['booked']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing booked invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of booked invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'booked',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing booked invoices:', error.message);
      throw error;
    }
  }

  // Sync paid invoices only
  async syncPaidInvoices() {
    try {
      logger.info('Starting sync of paid invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'paid',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['paid']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing paid invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of paid invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'paid',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing paid invoices:', error.message);
      throw error;
    }
  }

  // Sync unpaid invoices only
  async syncUnpaidInvoices() {
    try {
      logger.info('Starting sync of unpaid invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'unpaid',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['unpaid']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing unpaid invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of unpaid invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'unpaid',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing unpaid invoices:', error.message);
      throw error;
    }
  }

  // Sync overdue invoices only
  async syncOverdueInvoices() {
    try {
      logger.info('Starting sync of overdue invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'overdue',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['overdue']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing overdue invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of overdue invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'overdue',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing overdue invoices:', error.message);
      throw error;
    }
  }

  // Sync not-due invoices only
  async syncNotDueInvoices() {
    try {
      logger.info('Starting sync of not-due invoices across all agreements');
      const startTime = new Date();
      const agreementResults = [];
      let totalCount = 0;
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          type: 'not-due',
          count: 0
        };
      }
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncAgreementInvoices(agreement, ['not-due']);
          agreementResults.push(result);
          totalCount += result.totalCount;
        } catch (error) {
          logger.error(`Error syncing not-due invoices for agreement ${agreement.name}:`, error.message);
        }
      }
      
      logger.info(`Completed sync of not-due invoices: ${totalCount} invoices processed`);
      
      return {
        status: 'success',
        type: 'not-due',
        count: totalCount,
        results: agreementResults
      };
    } catch (error) {
      logger.error('Error syncing not-due invoices:', error.message);
      throw error;
    }
  }
  
  // Update invoice status
  async updateInvoiceStatus(id, newStatus) {
    try {
      // Find the invoice
      const invoice = await InvoiceModel.findById(id);
      
      if (!invoice) {
        throw ApiError.notFound(`Invoice with ID ${id} not found`);
      }
      
      // Update status
      await db.query(
        'UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, id]
      );
      
      logger.info(`Updated invoice ${id} status to ${newStatus}`);
      
      return {
        id,
        status: newStatus
      };
    } catch (error) {
      logger.error(`Error updating invoice ${id} status:`, error.message);
      throw error;
    }
  }
  
  // Get invoices with filtering, sorting, and pagination
  async getInvoices(filters = {}, sort = {}, pagination = {}) {
    try {
      return await InvoiceModel.find(filters, sort, pagination);
    } catch (error) {
      logger.error('Error getting invoices:', error.message);
      throw error;
    }
  }
  
  // Get invoice by ID with its lines
  async getInvoiceWithLines(id) {
    try {
      const invoice = await InvoiceModel.findById(id);
      
      if (!invoice) {
        throw ApiError.notFound(`Invoice with ID ${id} not found`);
      }
      
      const lines = await InvoiceModel.getInvoiceLines(id);
      
      return {
        ...invoice,
        lines
      };
    } catch (error) {
      logger.error(`Error getting invoice ${id} with lines:`, error.message);
      throw error;
    }
  }
  
  // Get sync logs
  async getSyncLogs(limit = 10) {
    try {
      const logs = await db.query(
        'SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT ?',
        [limit]
      );
      
      return logs;
    } catch (error) {
      logger.error('Error getting sync logs:', error.message);
      throw error;
    }
  }

  // Get invoice statistics for all agreements
  async getInvoiceStatistics() {
    try {
      const stats = await db.query(`
        SELECT 
          agreement_number,
          payment_status,
          COUNT(*) as count,
          SUM(net_amount) as total_net_amount,
          SUM(gross_amount) as total_gross_amount,
          SUM(vat_amount) as total_vat_amount,
          MIN(date) as oldest_date,
          MAX(date) as newest_date
        FROM 
          invoices
        GROUP BY 
          agreement_number, payment_status
        ORDER BY 
          agreement_number, payment_status
      `);

      return stats;
    } catch (error) {
      logger.error('Error getting invoice statistics:', error.message);
      throw error;
    }
  }
  
  // Get statistics for a specific agreement
  async getAgreementStatistics(agreementNumber) {
    try {
      const stats = await db.query(`
        SELECT 
          payment_status,
          COUNT(*) as count,
          SUM(net_amount) as total_net_amount,
          SUM(gross_amount) as total_gross_amount,
          SUM(vat_amount) as total_vat_amount,
          MIN(date) as oldest_date,
          MAX(date) as newest_date
        FROM 
          invoices
        WHERE
          agreement_number = ?
        GROUP BY 
          payment_status
        ORDER BY 
          payment_status
      `, [agreementNumber]);

      return stats;
    } catch (error) {
      logger.error(`Error getting statistics for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  // Get agreement info - delegated to API client
  async getAgreementInfo(agreementToken) {
    try {
      const client = agreementToken 
        ? this.getClientForAgreement(agreementToken)
        : apiClient;
      
      return await client.getAgreementInfo();
    } catch (error) {
      logger.error('Error fetching agreement info:', error.message);
      throw error;
    }
  }
  
  // Get invoices for a specific agreement
  async getInvoicesByAgreement(agreementNumber, filters = {}, sort = {}, pagination = {}) {
    try {
      // Add agreement filter
      filters.agreement_number = agreementNumber;
      
      return await InvoiceModel.find(filters, sort, pagination);
    } catch (error) {
      logger.error(`Error getting invoices for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  // Clean up duplicate invoices based on invoice_number
  async cleanupDuplicateInvoices() {
    const startTime = new Date();
    let cleanedCount = 0;
    
    try {
      logger.info('Starting cleanup of duplicate invoices');
      
      // Get all active agreements
      const agreements = await this.getActiveAgreements();
      
      // For each agreement
      for (const agreement of agreements) {
        // Get all distinct invoice numbers for this agreement
        const invoiceNumbers = await db.query(
          'SELECT DISTINCT invoice_number FROM invoices WHERE agreement_number = ? AND invoice_number IS NOT NULL',
          [agreement.agreement_number]
        );
        
        // Process each invoice number within this agreement
        for (const row of invoiceNumbers) {
          const invoiceNumber = row.invoice_number;
          
          // Find all invoices with this number in this agreement
          const invoices = await db.query(
            'SELECT * FROM invoices WHERE invoice_number = ? AND agreement_number = ? ORDER BY updated_at DESC',
            [invoiceNumber, agreement.agreement_number]
          );
          
          // Skip if there's only one or none
          if (invoices.length <= 1) continue;
          
          // Keep the most recently updated one
          const mostRecent = invoices[0];
          const duplicates = invoices.slice(1);
          
          // Delete the duplicates
          for (const dup of duplicates) {
            await db.query('DELETE FROM invoices WHERE id = ?', [dup.id]);
            cleanedCount++;
          }
        }
      }
      
      logger.info(`Cleanup complete. Removed ${cleanedCount} duplicate invoices`);
      
      // Record cleanup
      await InvoiceModel.recordSyncLog(
        'invoices_cleanup',
        'cleanup',
        'success',
        cleanedCount,
        null,
        startTime
      );
      
      return {
        status: 'success',
        count: cleanedCount
      };
    } catch (error) {
      logger.error('Error cleaning up duplicate invoices:', error.message);
      
      // Record failed cleanup
      await InvoiceModel.recordSyncLog(
        'invoices_cleanup',
        'cleanup',
        'error',
        cleanedCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }
}

module.exports = new InvoiceService();