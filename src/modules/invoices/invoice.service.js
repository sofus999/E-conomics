const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const InvoiceModel = require('./invoice.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const config = require('../../config');
const db = require('../../db');

class InvoiceService {
  constructor() {
    // Default agreement number from config
    this.defaultAgreementNumber = config.api.agreementNumber;
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
    // Extract customer details
    const customerName = invoice.customer?.name || invoice.recipient?.name || 'Unknown Customer';
    const customerNumber = invoice.customer?.customerNumber || null;
    
    // Base transformed data
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
      vat_amount: invoice.vatAmount
    };
    
    // Set invoice number based on type
    if (type === 'draft') {
      transformed.draft_invoice_number = invoice.draftInvoiceNumber;
      transformed.payment_status = 'draft'; // Special status for drafts
    } else {
      transformed.invoice_number = invoice.bookedInvoiceNumber;
      
      // Determine payment status for non-draft invoices
      if (type === 'paid' || (invoice.remainder === 0 && invoice.remainder !== undefined)) {
        transformed.payment_status = 'paid';
      } else if (type === 'overdue' || (invoice.remainder > 0 && new Date(invoice.dueDate) < new Date())) {
        transformed.payment_status = 'overdue';
      } else {
        // This covers unpaid and not-due invoices
        transformed.payment_status = 'pending';
      }
    }
    
    // Extract notes
    if (invoice.notes) {
      transformed.notes = [invoice.notes.heading, invoice.notes.textLine1, invoice.notes.textLine2]
        .filter(Boolean).join(' - ');
    }
    
    // Extract reference
    if (invoice.references && invoice.references.other) {
      transformed.reference_number = invoice.references.other;
    }
    
    return transformed;
  }

    
  // Transform invoice lines
  transformInvoiceLines(invoice, invoiceNumber, agreementNumber) {
    if (!invoice.lines || !Array.isArray(invoice.lines)) {
      return [];
    }
    
    // Get customer number from the invoice
    const customerNumber = invoice.customer?.customerNumber || null;
    
    return invoice.lines.map((line) => ({
      invoice_id: invoiceNumber,
      agreement_number: agreementNumber,
      customer_number: customerNumber,
      line_number: line.lineNumber,
      product_number: line.product?.productNumber,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitNetPrice,
      discount_percentage: line.discountPercentage,
      unit: line.unit?.name,
      total_net_amount: line.totalNetAmount
    }));
  }
  // Get detailed invoice by number (including line items)
  async getDetailedInvoice(invoiceNumber, type, client) {
    try {
      let endpoint;
      
      if (type === 'draft') {
        // Use draft endpoint for draft invoices
        endpoint = `${endpoints.INVOICES_DRAFTS}/${invoiceNumber}`;
      } else {
        // For all other types, use booked endpoint
        endpoint = `${endpoints.INVOICES_BOOKED}/${invoiceNumber}`;
      }
      
      const detailedInvoice = await client.get(endpoint);
      logger.debug(`Fetched detailed invoice #${invoiceNumber} from ${type} endpoint`);
      
      return detailedInvoice;
    } catch (error) {
      logger.error(`Error getting detailed invoice #${invoiceNumber} of type ${type}:`, error.message);
      return null;
    }
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

      // Log the agreement number to confirm it's available
      logger.debug(`Agreement number from API: ${agreementNumber}`);    

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
          
          for (const invoice of invoices) {
            // Transform API data to our model
            const invoiceData = this.transformInvoiceData(invoice, type, agreementNumber);

            // Verify we have agreement number before the smartUpsert call
            logger.debug(`Processing invoice ${invoiceData.invoice_number || invoiceData.draft_invoice_number}, agreement: ${agreementNumber}`);
          
            // Smart upsert the invoice with explicit agreement number parameter
            const savedInvoice = await InvoiceModel.smartUpsert(invoiceData, agreementNumber);
            
            // Get the correct invoice number based on type
            const invoiceNumber = type === 'draft' ? invoice.draftInvoiceNumber : (invoice.bookedInvoiceNumber || invoice.draftInvoiceNumber);
            
            // Get detailed invoice to access line items
            const detailedInvoice = await this.getDetailedInvoice(invoiceNumber, type, client);
            
            // Process invoice lines if available
            if (detailedInvoice && (detailedInvoice.lines || [])) {
              const lines = this.transformInvoiceLines(detailedInvoice, invoiceNumber, agreementNumber);
              await InvoiceModel.saveInvoiceLines(invoiceNumber, agreementNumber, invoiceData.customer_number, lines);
              logger.debug(`Saved ${lines.length} lines for invoice #${invoiceNumber}`);
            } else {
              logger.debug(`No line items available for invoice #${invoiceNumber}`);
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