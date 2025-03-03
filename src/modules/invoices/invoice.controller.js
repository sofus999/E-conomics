const invoiceService = require('./invoice.service');
const logger = require('../core/logger');

class InvoiceController {
  // Sync all invoices across all agreements
  async syncAllInvoices(req, res, next) {
    try {
      const result = await invoiceService.syncAllInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync invoices for a specific agreement
  async syncAgreementInvoices(req, res, next) {
    try {
      const { id } = req.params;
      const result = await invoiceService.syncInvoicesByAgreementId(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Clean up duplicate invoices
  async cleanupDuplicates(req, res, next) {
    try {
      const result = await invoiceService.cleanupDuplicateInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InvoiceController();