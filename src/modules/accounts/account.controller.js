const accountService = require('./account.service');
const logger = require('../core/logger');

class AccountController {
  async syncAccounts(req, res, next) {
    try {
      const result = await accountService.syncAllAccounts();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncAccountsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await accountService.syncAccountsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccounts(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const accounts = await accountService.getAccountsByAgreement(parseInt(agreement_number));
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccountByNumber(req, res, next) {
    try {
      const { agreement_number, account_number } = req.params;
      const account = await accountService.getAccountByNumber(
        parseInt(account_number), 
        parseInt(agreement_number)
      );
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountController();