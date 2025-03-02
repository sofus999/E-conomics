const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const AccountingYearModel = require('./accounting-year.model');
const AccountingPeriodModel = require('./accounting-period.model');
const AccountingEntryModel = require('./accounting-entry.model');
const AccountingTotalModel = require('./accounting-total.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AccountingYearService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformAccountingYearData(year, agreementNumber) {
    return {
      year: year.year,
      agreement_number: agreementNumber,
      start_date: year.fromDate,
      end_date: year.toDate,
      closed: year.closed || false,
      self_url: year.self
    };
  }

  transformAccountingPeriodData(period, year, agreementNumber) {
    return {
      period_number: period.periodNumber,
      year: year,
      agreement_number: agreementNumber,
      from_date: period.fromDate,
      to_date: period.toDate,
      barred: period.barred || false,
      self_url: period.self
    };
  }

  transformAccountingEntryData(entry, year, periodNumber, agreementNumber) {
    return {
      entry_number: entry.entryNumber,
      year: year,
      period_number: periodNumber,
      agreement_number: agreementNumber,
      account_number: entry.account.accountNumber,
      amount: entry.amount,
      amount_in_base_currency: entry.amountInBaseCurrency,
      currency: entry.currency,
      entry_date: entry.date,
      entry_text: entry.text,
      entry_type: entry.entryType,
      voucher_number: entry.voucherNumber,
      self_url: entry.self
    };
  }

  transformAccountingTotalData(total, year, periodNumber, agreementNumber) {
    return {
      account_number: total.account.accountNumber,
      year: year,
      period_number: periodNumber,
      agreement_number: agreementNumber,
      total_in_base_currency: total.totalInBaseCurrency,
      from_date: total.fromDate,
      to_date: total.toDate
    };
  }

  async syncAccountingYearsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting years sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const accountingYears = await client.getPaginated('/accounting-years');
      logger.info(`Found ${accountingYears.length} accounting years for agreement ${agreementNumber}`);
      
      for (const year of accountingYears) {
        const yearData = this.transformAccountingYearData(year, agreementNumber);
        await AccountingYearModel.upsert(yearData);
        recordCount++;
        
        // Optionally sync periods for each year
        await this.syncAccountingPeriodsForYear(agreement, year.year);
      }
      
      await AccountingYearModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting years sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting years for agreement ${agreement.id}:`, error.message);
      
      await AccountingYearModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAccountingPeriodsForYear(agreement, year) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting periods sync for year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const periods = await client.getPaginated(`/accounting-years/${year}/periods`);
      logger.info(`Found ${periods.length} accounting periods for year ${year} and agreement ${agreementNumber}`);
      
      for (const period of periods) {
        const periodData = this.transformAccountingPeriodData(period, year, agreementNumber);
        await AccountingPeriodModel.upsert(periodData);
        recordCount++;
        
        // Optionally sync entries and totals for each period
        // This might be disabled by default to avoid excessive API calls
        // await this.syncAccountingEntriesForPeriod(agreement, year, period.periodNumber);
        // await this.syncAccountingTotalsForPeriod(agreement, year, period.periodNumber);
      }
      
      await AccountingPeriodModel.recordSyncLog(
        agreementNumber,
        year,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting periods sync for year ${year} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        year,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting periods for year ${year} and agreement ${agreement.id}:`, error.message);
      
      await AccountingPeriodModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        year,
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Methods for syncing entries and totals would follow a similar pattern
  // Additional methods would be implemented for retrieving data

  async syncAllAccountingYears() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of accounting years across all agreements');
      
      const agreements = await AgreementModel.getAll(true);
      
      if (agreements.length === 0) {
        logger.warn('No active agreements found for sync');
        return {
          status: 'warning',
          message: 'No active agreements found',
          results: [],
          totalCount: 0
        };
      }
      
      for (const agreement of agreements) {
        try {
          const result = await this.syncAccountingYearsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing accounting years for agreement ${agreement.name}:`, error.message);
          agreementResults.push({
            agreement: {
              id: agreement.id,
              name: agreement.name,
              agreement_number: agreement.agreement_number
            },
            status: 'error',
            error: error.message
          });
        }
      }
      
      logger.info(`Completed accounting years sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall accounting years sync process:', error.message);
      throw error;
    }
  }

  async getAccountingYearsByAgreement(agreementNumber) {
    try {
      return await AccountingYearModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting accounting years for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getAccountingYearByYear(year, agreementNumber) {
    try {
      const accountingYear = await AccountingYearModel.findByYearAndAgreement(year, agreementNumber);
      
      if (!accountingYear) {
        throw ApiError.notFound(`Accounting year ${year} not found for agreement ${agreementNumber}`);
      }
      
      return accountingYear;
    } catch (error) {
      logger.error(`Error getting accounting year ${year} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Additional methods for retrieving periods, entries, and totals
}

module.exports = new AccountingYearService();