// modules/invoices/invoice.controller.js
const invoiceService = require('./invoice.service');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class InvoiceController {
  
  async cleanupDuplicates(req, res, next) {
    try {
      const result = await invoiceService.cleanupDuplicateInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Trigger sync of all invoices across all agreements
  async syncInvoices(req, res, next) {
    try {
      const result = await invoiceService.syncAllInvoices();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Trigger sync of invoices for a specific agreement
  async syncAgreementInvoices(req, res, next) {
    try {
      const { id } = req.params;
      const result = await invoiceService.syncInvoicesByAgreementId(id);
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
        agreement_number,
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
      if (agreement_number) filters.agreement_number = parseInt(agreement_number);
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

  // Get agreement info for all active agreements
  async getAllAgreementsInfo(req, res, next) {
    try {
      const agreements = await invoiceService.getActiveAgreements();
      const agreementsInfo = [];
      
      for (const agreement of agreements) {
        try {
          const client = invoiceService.getClientForAgreement(agreement.agreement_grant_token);
          const info = await client.getAgreementInfo();
          
          agreementsInfo.push({
            id: agreement.id,
            name: agreement.name,
            agreement_number: agreement.agreement_number,
            company_name: info.companyName,
            user_name: info.userName,
            company_vat_number: info.companyVatNumber
          });
        } catch (error) {
          logger.error(`Error getting info for agreement ${agreement.name}:`, error.message);
          
          agreementsInfo.push({
            id: agreement.id,
            name: agreement.name,
            agreement_number: agreement.agreement_number,
            error: error.message
          });
        }
      }
      
      res.json(agreementsInfo);
    } catch (error) {
      next(error);
    }
  }

  // Get invoices for a specific agreement
  async getAgreementInvoices(req, res, next) {
    try {
      const { agreement_number } = req.params;
      
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
      
      // Get invoices for the specified agreement
      const result = await invoiceService.getInvoicesByAgreement(
        parseInt(agreement_number),
        filters,
        sort,
        pagination
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Get statistics for a specific agreement
  async getAgreementStatistics(req, res, next) {
    try {
      const { agreement_number } = req.params;
      
      // Query directly with specific agreement number
      const stats = await db.query(`
        SELECT 
          invoice_type,
          payment_status,
          COUNT(*) as count,
          SUM(net_amount) as total_net_amount,
          SUM(gross_amount) as total_gross_amount,
          SUM(vat_amount) as total_vat_amount
        FROM 
          invoices
        WHERE
          agreement_number = ?
        GROUP BY 
          invoice_type, payment_status
        ORDER BY 
          invoice_type, payment_status
      `, [agreement_number]);
      
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InvoiceController();