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
  
  async getAccountingPeriods(req, res, next) {
    try {
      const { agreement_number, year } = req.params;
      const periods = await accountingYearService.getAccountingPeriodsByYear(year, parseInt(agreement_number));
      res.json(periods);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccountingPeriodByNumber(req, res, next) {
    try {
      const { agreement_number, year, period_number } = req.params;
      const period = await accountingYearService.getAccountingPeriodByNumber(
        parseInt(period_number), 
        year, 
        parseInt(agreement_number)
      );
      res.json(period);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccountingEntriesByPeriod(req, res, next) {
    try {
      const { agreement_number, year, period_number } = req.params;
      
      // Parse pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      
      const entries = await accountingYearService.getAccountingEntriesByPeriod(
        parseInt(period_number), 
        year, 
        parseInt(agreement_number),
        { page, limit }
      );
      
      res.json(entries);
    } catch (error) {
      next(error);
    }
  }
  
  async getAccountingTotalsByPeriod(req, res, next) {
    try {
      const { agreement_number, year, period_number } = req.params;
      const totals = await accountingYearService.getAccountingTotalsByPeriod(
        parseInt(period_number), 
        year, 
        parseInt(agreement_number)
      );
      res.json(totals);
    } catch (error) {
      next(error);
    }
  }
  
  async syncAccountingPeriodEntries(req, res, next) {
    try {
      const { agreement_number, year, period_number } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(req.params.id);
      
      const result = await accountingYearService.syncAccountingEntriesForPeriod(
        agreement,
        year,
        parseInt(period_number)
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncAccountingPeriodTotals(req, res, next) {
    try {
      const { agreement_number, year, period_number } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(req.params.id);
      
      const result = await accountingYearService.syncAccountingTotalsForPeriod(
        agreement,
        year,
        parseInt(period_number)
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncAccountingYearTotals(req, res, next) {
    try {
      const { agreement_number, year } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(req.params.id);
      
      const result = await accountingYearService.syncAccountingTotalsForYear(
        agreement,
        year
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountingYearController();