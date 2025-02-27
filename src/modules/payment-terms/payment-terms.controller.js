const paymentTermsService = require('./payment-terms.service');
const logger = require('../core/logger');

class PaymentTermsController {
  // Sync payment terms for all agreements
  async syncPaymentTerms(req, res, next) {
    try {
      const result = await paymentTermsService.syncAllPaymentTerms();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync payment terms for a specific agreement
  async syncPaymentTermsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await paymentTermsService.syncPaymentTermsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get payment terms for an agreement
  async getPaymentTerms(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const terms = await paymentTermsService.getPaymentTermsByAgreement(parseInt(agreement_number));
      res.json(terms);
    } catch (error) {
      next(error);
    }
  }
  
  // Get payment term by number
  async getPaymentTermByNumber(req, res, next) {
    try {
      const { agreement_number, terms_number } = req.params;
      const term = await paymentTermsService.getPaymentTermByNumber(parseInt(terms_number), parseInt(agreement_number));
      res.json(term);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentTermsController();