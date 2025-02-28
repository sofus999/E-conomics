const accountingYearService = require('./accounting-year.service');
const logger = require('../core/logger');

class AccountingYearController {
  async syncAccountingYears(req, res, next) {
    try {
      const result = await accountingYearService.syncAllAccountingYears();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
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
  
  async getAccountingYears(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const years = await accountingYearService.getAccountingYearsByAgreement(parseInt(agreement_number));
      res.json(years);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccountingYearByYear(req, res, next) {
    try {
      const { agreement_number, year } = req.params;
      const accountingYear = await accountingYearService.getAccountingYearByYear(year, parseInt(agreement_number));
      res.json(accountingYear);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountingYearController();