const accountingYearService = require('./accounting-year.service');
const logger = require('../core/logger');

class AccountingYearController {
  /**
   * Sync accounting years for all agreements
   */
  async syncAccountingYears(req, res, next) {
    try {
      const result = await accountingYearService.syncAllAccountingYears();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Sync accounting years for a specific agreement
   */
  async syncAccountingYearsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await accountingYearService.syncAccountingYearsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountingYearController();