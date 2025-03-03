const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const AccountingYearModel = require('./accounting-year.model');
const AccountingPeriodModel = require('./accounting-period.model');
const AccountingEntryModel = require('./accounting-entry.model');
const AccountingTotalModel = require('./accounting-total.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');

class AccountingYearService {
  /**
   * Get client for a specific agreement
   */
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  /**
   * Transform API accounting year data to our database model
   */
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

  /**
   * Transform API accounting period data to our database model
   */
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

  /**
   * Transform API accounting entry data to our database model
   */
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
      entry_type: entry.entryType || null,
      voucher_number: entry.voucherNumber || null,
      self_url: entry.self
    };
  }

  /**
   * Transform API accounting total data to our database model
   */
  transformAccountingTotalData(total, year, periodNumber, agreementNumber) {
    return {
      account_number: total.account.accountNumber,
      year: year,
      period_number: periodNumber || 0, // Use 0 for year totals
      agreement_number: agreementNumber,
      total_in_base_currency: total.totalInBaseCurrency,
      from_date: total.fromDate,
      to_date: total.toDate
    };
  }

  /**
   * Sync accounting years for a specific agreement
   */
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
        
        // Sync periods for each year
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

  /**
   * Sync accounting periods for a specific year
   */
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
        
        // Sync entries and totals for each period
        await this.syncAccountingEntriesForPeriod(agreement, year, period.periodNumber);
        await this.syncAccountingTotalsForPeriod(agreement, year, period.periodNumber);
      }
      
      // Sync year totals
      await this.syncAccountingTotalsForYear(agreement, year);
      
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

  /**
   * Sync accounting entries for a specific period
   */
  async syncAccountingEntriesForPeriod(agreement, year, periodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting entries sync for period ${periodNumber}, year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const entries = await client.getPaginated(`/accounting-years/${year}/periods/${periodNumber}/entries`);
      logger.info(`Found ${entries.length} accounting entries for period ${periodNumber}, year ${year} and agreement ${agreementNumber}`);
      
      // Process entries in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const transformedEntries = batch.map(entry => 
          this.transformAccountingEntryData(entry, year, periodNumber, agreementNumber)
        );
        
        const result = await AccountingEntryModel.batchUpsert(transformedEntries);
        recordCount += result.inserted + result.updated;
      }
      
      await AccountingEntryModel.recordSyncLog(
        agreementNumber,
        year,
        periodNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting entries sync for period ${periodNumber}, year ${year} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        year,
        period: periodNumber,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting entries for period ${periodNumber}, year ${year} and agreement ${agreement.id}:`, error.message);
      
      await AccountingEntryModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        year,
        periodNumber,
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  /**
   * Sync accounting totals for a specific period
   */
  async syncAccountingTotalsForPeriod(agreement, year, periodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for period ${periodNumber}, year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const totals = await client.getPaginated(`/accounting-years/${year}/periods/${periodNumber}/totals`);
      logger.info(`Found ${totals.length} accounting totals for period ${periodNumber}, year ${year} and agreement ${agreementNumber}`);
      
      const transformedTotals = totals.map(total => 
        this.transformAccountingTotalData(total, year, periodNumber, agreementNumber)
      );
      
      const result = await AccountingTotalModel.batchUpsert(transformedTotals);
      recordCount = result.inserted + result.updated;
      
      await AccountingTotalModel.recordSyncLog(
        agreementNumber,
        year,
        periodNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting totals sync for period ${periodNumber}, year ${year} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        year,
        period: periodNumber,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting totals for period ${periodNumber}, year ${year} and agreement ${agreement.id}:`, error.message);
      
      await AccountingTotalModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        year,
        periodNumber,
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  /**
   * Sync accounting totals for a specific year
   */
  async syncAccountingTotalsForYear(agreement, year) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const totals = await client.getPaginated(`/accounting-years/${year}/totals`);
      logger.info(`Found ${totals.length} accounting totals for year ${year} and agreement ${agreementNumber}`);
      
      const transformedTotals = totals.map(total => 
        this.transformAccountingTotalData(total, year, null, agreementNumber)
      );
      
      const result = await AccountingTotalModel.batchUpsert(transformedTotals);
      recordCount = result.inserted + result.updated;
      
      await AccountingTotalModel.recordSyncLog(
        agreementNumber,
        year,
        null,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting totals sync for year ${year} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
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
      logger.error(`Error syncing accounting totals for year ${year} and agreement ${agreement.id}:`, error.message);
      
      await AccountingTotalModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        year,
        null,
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  /**
   * Sync all accounting years across all agreements
   */
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
}

module.exports = new AccountingYearService();