const apiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const InvoiceModel = require('./invoice.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');
const db = require('../../db');

class InvoiceService {
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
      currency: invoice.currency,
      exchange_rate: invoice.exchangeRate,
      date: invoice.date,
      due_date: invoice.dueDate,
      net_amount: invoice.netAmount,
      gross_amount: invoice.grossAmount,
      vat_amount: invoice.vatAmount,
      invoice_type: type,
      data: invoice // Store the full API response
    };
    
    // Add invoice-type specific fields
    if (type === 'draft') {
      transformed.draft_invoice_number = invoice.draftInvoiceNumber;
      transformed.id = `draft-${invoice.draftInvoiceNumber}`;
      transformed.payment_status = 'pending';
    } else if (type === 'booked') {
      transformed.invoice_number = invoice.invoiceNumber;
      transformed.id = `booked-${invoice.invoiceNumber}`;
      transformed.payment_status = 'pending';
    } else if (type === 'paid') {
      transformed.invoice_number = invoice.invoiceNumber;
      transformed.id = `paid-${invoice.invoiceNumber}`;
      transformed.payment_status = 'paid';
    } else if (type === 'unpaid') {
      transformed.invoice_number = invoice.invoiceNumber;
      transformed.id = `unpaid-${invoice.invoiceNumber}`;
      transformed.payment_status = 'overdue';
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
      
      // Fetch all draft invoices
      const drafts = await apiClient.getPaginated(endpoints.INVOICES_DRAFTS);
      logger.info(`Found ${drafts.length} draft invoices`);
      
      // Process each draft invoice
      for (const draft of drafts) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(draft, 'draft');
        
        // Upsert the invoice
        const savedInvoice = await InvoiceModel.upsert(invoiceData);
        
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
      
      // Fetch all booked invoices
      const booked = await apiClient.getPaginated(endpoints.INVOICES_BOOKED);
      logger.info(`Found ${booked.length} booked invoices`);
      
      // Process each booked invoice
      for (const invoice of booked) {
        // Transform API data to our model
        const invoiceData = this.transformInvoiceData(invoice, 'booked');
        
        // Upsert the invoice
        const savedInvoice = await InvoiceModel.upsert(invoiceData);
        
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
  
  // Sync all invoices
  async syncAllInvoices() {
    const startTime = new Date();
    const results = {};
    
    try {
      logger.info('Starting sync of all invoice types');
      
      // Sync draft invoices
      results.draft = await this.syncDraftInvoices();
      
      // Sync booked invoices
      results.booked = await this.syncBookedInvoices();
      
      // Record successful sync of all invoices
      await InvoiceModel.recordSyncLog(
        'invoices_all',
        'sync',
        'success',
        results.draft.count + results.booked.count,
        null,
        startTime
      );
      
      return {
        status: 'success',
        results
      };
    } catch (error) {
      logger.error('Error syncing all invoices:', error.message);
      
      // Record failed sync
      await InvoiceModel.recordSyncLog(
        'invoices_all',
        'sync',
        'error',
        0,
        error.message,
        startTime
      );
      
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
}

module.exports = new InvoiceService();