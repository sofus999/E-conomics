const invoiceService = require('./invoice.service');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class InvoiceController {
  // Trigger sync of all invoices
  async syncInvoices(req, res, next) {
    try {
      const result = await invoiceService.syncAllInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Trigger sync of draft invoices only
  async syncDraftInvoices(req, res, next) {
    try {
      const result = await invoiceService.syncDraftInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Trigger sync of booked invoices only
  async syncBookedInvoices(req, res, next) {
    try {
      const result = await invoiceService.syncBookedInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get invoices with filtering
  async getInvoices(req, res, next) {
    try {
      // Extract query parameters
      const {
        customer_number,
        invoice_type,
        payment_status,
        date_from,
        date_to,
        sort_by,
        sort_order,
        page,
        limit
      } = req.query;
      
      // Build filters object
      const filters = {};
      
      if (customer_number) filters.customer_number = parseInt(customer_number);
      if (invoice_type) filters.invoice_type = invoice_type;
      if (payment_status) filters.payment_status = payment_status;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;
      
      // Build sort object
      const sort = {
        field: sort_by || 'date',
        order: sort_order || 'DESC'
      };
      
      // Build pagination object
      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      };
      
      // Get invoices
      const result = await invoiceService.getInvoices(filters, sort, pagination);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get invoice by ID
  async getInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const invoice = await invoiceService.getInvoiceWithLines(id);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
  
  // Get sync logs
  async getSyncLogs(req, res, next) {
    try {
      const { limit } = req.query;
      const logs = await invoiceService.getSyncLogs(parseInt(limit) || 10);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InvoiceController();