const vatAccountService = require('./vat-account.service');
const logger = require('../core/logger');

class VatAccountController {
  // Sync VAT accounts for all agreements
  async syncVatAccounts(req, res, next) {
    try {
      const result = await vatAccountService.syncAllVatAccounts();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync VAT accounts for a specific agreement
  async syncVatAccountsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await vatAccountService.syncVatAccountsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get VAT accounts for an agreement
  async getVatAccounts(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const accounts = await vatAccountService.getVatAccountsByAgreement(parseInt(agreement_number));
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  }
  
  // Get VAT account by code
  async getVatAccountByCode(req, res, next) {
    try {
      const { agreement_number, vat_code } = req.params;
      const account = await vatAccountService.getVatAccountByCode(vat_code, parseInt(agreement_number));
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VatAccountController();