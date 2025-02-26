const apiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const InvoiceModel = require('./invoice.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');
const db = require('../../db');
const config = require('../../config');

class InvoiceService {
  constructor() {
    // Initialize agreement number if available
    this.agreementNumber = null;
    this.initializeAgreementNumber();
  }
  
  // Initialize agreement number
  async initializeAgreementNumber() {
    if (!this.agreementNumber) {
      try {
        // Try to get from config
        if (config.api.agreementNumber) {
          this.agreementNumber = config.api.agreementNumber;
          logger.info(`Using agreement number from config: ${this.agreementNumber}`);
          return this.agreementNumber;
        }
        
        // Try to get from API
        const selfData = await apiClient.get(endpoints.SELF);
        if (selfData && selfData.agreementNumber) {
          this.agreementNumber = selfData.agreementNumber;
          logger.info(`Retrieved agreement number from API: ${this.agreementNumber}`);
          return this.agreementNumber;
        }
        
        logger.warn('Could not determine agreement number');
        return null;
      } catch (error) {
        logger.error('Error initializing agreement number:', error.message);
        return null;
      }
    }
    
    return this.agreementNumber;
  }

  // Transform API invoice data to our database model
  transformInvoiceData(invoice, type) {
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
      agreement_number: this.agreementNumber,
      currency: invoice.currency,
      exchange_rate: invoice.exchangeRate,
      date: invoice.date,
      due_date: invoice.dueDate,
      net_amount: invoice.netAmount,
      gross_amount: invoice.grossAmount,
      vat_amount: invoice.vatAmount,
      data: invoice // Store the full API response
    };
    
    // Map API invoice types to database-compatible types
    // In the database, invoice_type is enum('draft','booked','paid','unpaid')
    let dbInvoiceType;
    let paymentStatus;
    
    // Handle different invoice types and set appropriate database values
    if (type === 'draft') {
      dbInvoiceType = 'draft';
      paymentStatus = 'pending';
      transformed.draft_invoice_number = invoice.draftInvoiceNumber;
    } else if (type === 'booked') {
      dbInvoiceType = 'booked';
      paymentStatus = 'pending';
    } else if (type === 'paid') {
      dbInvoiceType = 'paid';
      paymentStatus = 'paid';
    } else if (type === 'unpaid') {
      dbInvoiceType = 'unpaid';
      paymentStatus = 'pending';
    } else if (type === 'overdue') {
      // Map 'overdue' to 'unpaid' for database compatibility
      dbInvoiceType = 'unpaid';
      paymentStatus = 'overdue';
    } else if (type === 'not-due') {
      // Map 'not-due' to 'unpaid' for database compatibility
      dbInvoiceType = 'unpaid';
      paymentStatus = 'pending';
    }
    
    // Add mapped values to transformed data
    transformed.invoice_type = dbInvoiceType;
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
  
  // Sync draft invoices
  async syncDraftInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of draft invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all draft invoices
      const drafts = await apiClient.getPaginated(endpoints.INVOICES_DRAFTS);
      logger.info(`Found ${drafts.length} draft invoices`);
      
      // Process each draft invoice
      for (const draft of drafts) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(draft, 'draft');
        
        // Smart upsert the invoice
        const savedInvoice = await InvoiceModel.smartUpsert(invoiceData);
        
        // Process invoice lines if available
        if (draft.lines) {
          const lines = this.transformInvoiceLines(draft, savedInvoice.id);
          await InvoiceModel.saveInvoiceLines(savedInvoice.id, lines);
        }
        
        recordCount++;
      }
      
      // Record successful sync
      await InvoiceModel.recordSyncLog(
        'invoices_draft',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} draft invoices`);
      
      return {
        status: 'success',
        type: 'draft',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing draft invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_draft',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }
  
  // Sync booked invoices
  async syncBookedInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of booked invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all booked invoices
      const booked = await apiClient.getPaginated(endpoints.INVOICES_BOOKED);
      logger.info(`Found ${booked.length} booked invoices`);
      
      // Process each booked invoice
      for (const invoice of booked) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'booked');
        
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
        'invoices_booked',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} booked invoices`);
      
      return {
        status: 'success',
        type: 'booked',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing booked invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_booked',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync paid invoices
  async syncPaidInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of paid invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all paid invoices
      const paid = await apiClient.getPaginated(endpoints.INVOICES_PAID);
      logger.info(`Found ${paid.length} paid invoices`);
      
      // Process each paid invoice
      for (const invoice of paid) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'paid');
        
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
        'invoices_paid',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} paid invoices`);
      
      return {
        status: 'success',
        type: 'paid',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing paid invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_paid',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync unpaid invoices
  async syncUnpaidInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of unpaid invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all unpaid invoices
      const unpaid = await apiClient.getPaginated(endpoints.INVOICES_UNPAID);
      logger.info(`Found ${unpaid.length} unpaid invoices`);
      
      // Process each unpaid invoice
      for (const invoice of unpaid) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'unpaid');
        
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
        'invoices_unpaid',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} unpaid invoices`);
      
      return {
        status: 'success',
        type: 'unpaid',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing unpaid invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_unpaid',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync overdue invoices
  async syncOverdueInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of overdue invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all overdue invoices
      const overdue = await apiClient.getPaginated(endpoints.INVOICES_OVERDUE);
      logger.info(`Found ${overdue.length} overdue invoices`);
      
      // Process each overdue invoice
      for (const invoice of overdue) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'overdue');
        
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
        'invoices_overdue',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} overdue invoices`);
      
      return {
        status: 'success',
        type: 'overdue',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing overdue invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_overdue',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync not-due invoices
  async syncNotDueInvoices() {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info('Starting sync of not-due invoices');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Fetch all not-due invoices
      const notDue = await apiClient.getPaginated(endpoints.INVOICES_NOT_DUE);
      logger.info(`Found ${notDue.length} not-due invoices`);
      
      // Process each not-due invoice
      for (const invoice of notDue) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'not-due');
        
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
        'invoices_not_due',
        'sync',
        'success',
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced ${recordCount} not-due invoices`);
      
      return {
        status: 'success',
        type: 'not-due',
        count: recordCount
      };
    } catch (error) {
      logger.error('Error syncing not-due invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_not_due',
        'sync',
        'error',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }
  
  // Sync all invoices
  async syncAllInvoices() {
    const startTime = new Date();
    const results = {};
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of all invoice types');
      
      // Make sure agreement number is initialized
      await this.initializeAgreementNumber();
      
      // Sync draft invoices
      results.draft = await this.syncDraftInvoices();
      totalCount += results.draft.count;
      
      // Sync booked invoices
      results.booked = await this.syncBookedInvoices();
      totalCount += results.booked.count;
      
      // Sync paid invoices
      results.paid = await this.syncPaidInvoices();
      totalCount += results.paid.count;
      
      // Sync unpaid invoices
      results.unpaid = await this.syncUnpaidInvoices();
      totalCount += results.unpaid.count;
      
      // Sync overdue invoices
      results.overdue = await this.syncOverdueInvoices();
      totalCount += results.overdue.count;
      
      // Sync not-due invoices
      results.notDue = await this.syncNotDueInvoices();
      totalCount += results.notDue.count;
      
      // Record successful sync
      await InvoiceModel.recordSyncLog(
        'invoices_all',
        'sync',
        'success',
        totalCount,
        null,
        startTime
      );
      
      logger.info(`Successfully synced a total of ${totalCount} invoices of all types`);
      
      return {
        status: 'success',
        results,
        totalCount
      };
    } catch (error) {
      logger.error('Error syncing all invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_all',
        'sync',
        'error',
        totalCount, // Include count of successful syncs before the error
        error.message,
        startTime
      );
      
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
      // Add agreement filter if available
      if (this.agreementNumber) {
        filters.agreement_number = this.agreementNumber;
      }
      
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

  // Get invoice statistics
  async getInvoiceStatistics() {
    try {
      // Include agreement number filter if available
      const whereClause = this.agreementNumber 
        ? 'WHERE agreement_number = ?' 
        : '';
      const params = this.agreementNumber 
        ? [this.agreementNumber] 
        : [];
      
      const stats = await db.query(`
        SELECT 
          invoice_type,
          payment_status,
          COUNT(*) as count,
          SUM(net_amount) as total_net_amount,
          SUM(gross_amount) as total_gross_amount,
          SUM(vat_amount) as total_vat_amount,
          MIN(date) as oldest_date,
          MAX(date) as newest_date
        FROM 
          invoices
        ${whereClause}
        GROUP BY 
          invoice_type, payment_status
        ORDER BY 
          invoice_type, payment_status
      `, params);

      return stats;
    } catch (error) {
      logger.error('Error getting invoice statistics:', error.message);
      throw error;
    }
  }
  
  // Get agreement info
  async getAgreementInfo() {
    try {
      const selfData = await apiClient.get(endpoints.SELF);
      return {
        agreementNumber: selfData.agreementNumber,
        companyName: selfData.company?.name || 'Unknown',
        userName: selfData.userName,
        companyVatNumber: selfData.company?.vatNumber || null,
        agreementType: selfData.agreementType,
        bankInformation: selfData.bankInformation
      };
    } catch (error) {
      logger.error('Error fetching agreement info:', error.message);
      throw error;
    }
  }
  
  // Clean up duplicate invoices based on invoice_number
  async cleanupDuplicateInvoices() {
    const startTime = new Date();
    let cleanedCount = 0;
    
    try {
      logger.info('Starting cleanup of duplicate invoices');
      
      // Get all distinct invoice numbers
      const invoiceNumbers = await InvoiceModel.findDistinctInvoiceNumbers();
      
      // Process each invoice number
      for (const invoiceNumber of invoiceNumbers) {
        // Find all invoices with this number
        const invoices = await db.query(
          'SELECT * FROM invoices WHERE invoice_number = ? ORDER BY updated_at DESC',
          [invoiceNumber]
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