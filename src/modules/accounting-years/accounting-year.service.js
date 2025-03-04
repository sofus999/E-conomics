// src/modules/accounting-years/accounting-year.service.js
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
      year_id: year.year,
      agreement_number: agreementNumber,
      start_date: year.fromDate,
      end_date: year.toDate,
      closed: year.closed || false,
      self_url: year.self
    };
  }

  /**
   * Normalize period number to be within 0-12 range
   * 0 = annual, 1-12 = monthly
   */
  normalizePeriodNumber(apiPeriodNumber) {
    if (apiPeriodNumber === 0) return 0; // Annual total
    
    // Normalize to 1-12 by taking modulo 12, handling the special case where period is multiple of 12
    const normalizedPeriod = apiPeriodNumber % 12;
    return normalizedPeriod === 0 ? 12 : normalizedPeriod;
  }

  /**
   * Transform API accounting period data to our database model with normalized period numbers
   */
  transformAccountingPeriodData(period, yearId, agreementNumber) {
    const normalizedPeriodNumber = this.normalizePeriodNumber(period.periodNumber);
    
    return {
      period_number: normalizedPeriodNumber,
      year_id: yearId,
      agreement_number: agreementNumber,
      from_date: period.fromDate,
      to_date: period.toDate,
      barred: period.barred || false,
      self_url: period.self
    };
  }

  /**
   * Transform API accounting entry data to our database model with normalized period numbers
   */
  transformAccountingEntryData(entry, yearId, apiPeriodNumber, agreementNumber) {
    const normalizedPeriodNumber = this.normalizePeriodNumber(apiPeriodNumber);
    
    return {
      entry_number: entry.entryNumber,
      year_id: yearId,
      period_number: normalizedPeriodNumber,
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
   * Transform API accounting total data to our database model with normalized period numbers
   */
  transformAccountingTotalData(total, yearId, apiPeriodNumber, agreementNumber) {
    // For year totals, API period may be null, set to 0
    const normalizedPeriodNumber = apiPeriodNumber === null ? 0 : this.normalizePeriodNumber(apiPeriodNumber);
    
    return {
      account_number: total.account.accountNumber,
      year_id: yearId,
      period_number: normalizedPeriodNumber,
      agreement_number: agreementNumber,
      total_in_base_currency: total.totalInBaseCurrency,
      from_date: total.fromDate,
      to_date: total.toDate
    };
  }

  /**
   * Ensure period exists before trying to add entries or totals
   */
  async ensurePeriodExists(periodNumber, yearId, agreementNumber, fromDate, toDate) {
    try {
      const existing = await AccountingPeriodModel.findByNumberYearAndAgreement(
        periodNumber, yearId, agreementNumber
      );
      
      if (!existing) {
        logger.info(`Creating missing period ${periodNumber} for year ${yearId}, agreement ${agreementNumber}`);
        
        // Create default period
        await AccountingPeriodModel.upsert({
          period_number: periodNumber,
          year_id: yearId,
          agreement_number: agreementNumber,
          from_date: fromDate || new Date(`${yearId}-01-01`),
          to_date: toDate || new Date(`${yearId}-12-31`),
          barred: false,
          self_url: null
        });
        
        return true;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error ensuring period exists: ${error.message}`);
      return false;
    }
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
        const yearId = year.year;
        const yearData = this.transformAccountingYearData(year, agreementNumber);
        await AccountingYearModel.upsert(yearData);
        recordCount++;
        
        // For each year, ensure period 0 exists for year totals
        await this.ensurePeriodExists(0, yearId, agreementNumber, 
          yearData.start_date, yearData.end_date);
        
        // Sync periods for each year
        await this.syncAccountingPeriodsForYear(agreement, yearId);
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
  async syncAccountingPeriodsForYear(agreement, yearId) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting periods sync for year ${yearId} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const periods = await client.getPaginated(`/accounting-years/${yearId}/periods`);
      logger.info(`Found ${periods.length} accounting periods for year ${yearId} and agreement ${agreementNumber}`);
      
      // Create a set to track which normalized period numbers we've already processed
      const processedPeriods = new Set();
      
      for (const period of periods) {
        const periodData = this.transformAccountingPeriodData(period, yearId, agreementNumber);
        const normalizedPeriod = periodData.period_number;
        
        // Skip if we've already processed this normalized period
        if (processedPeriods.has(normalizedPeriod)) {
          logger.debug(`Skipping duplicate normalized period ${normalizedPeriod} for year ${yearId}`);
          continue;
        }
        
        await AccountingPeriodModel.upsert(periodData);
        processedPeriods.add(normalizedPeriod);
        recordCount++;
        
        // Sync entries and totals for each period
        try {
          await this.syncAccountingEntriesForPeriod(agreement, yearId, period.periodNumber);
        } catch (error) {
          logger.error(`Error syncing entries for period ${period.periodNumber}: ${error.message}`);
        }
        
        try {
          await this.syncAccountingTotalsForPeriod(agreement, yearId, period.periodNumber);
        } catch (error) {
          logger.error(`Error syncing totals for period ${period.periodNumber}: ${error.message}`);
        }
      }
      
      // Ensure we have period 0 for year totals
      if (!processedPeriods.has(0)) {
        const yearInfo = await AccountingYearModel.findByYearAndAgreement(yearId, agreementNumber);
        if (yearInfo) {
          await this.ensurePeriodExists(0, yearId, agreementNumber, yearInfo.start_date, yearInfo.end_date);
          recordCount++;
        }
      }
      
      // Sync year totals
      try {
        await this.syncAccountingTotalsForYear(agreement, yearId);
      } catch (error) {
        logger.error(`Error syncing year totals: ${error.message}`);
      }
      
      await AccountingPeriodModel.recordSyncLog(
        agreementNumber,
        yearId,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting periods sync for year ${yearId} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        yearId,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting periods for year ${yearId} and agreement ${agreement.id}:`, error.message);
      
      await AccountingPeriodModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        yearId,
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
  async syncAccountingEntriesForPeriod(agreement, yearId, apiPeriodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting entries sync for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const normalizedPeriodNumber = this.normalizePeriodNumber(apiPeriodNumber);
      
      // Ensure period exists before adding entries
      const periodExists = await this.ensurePeriodExists(
        normalizedPeriodNumber, 
        yearId, 
        agreementNumber,
        null, null // Will be set with default dates
      );
      
      if (!periodExists) {
        throw new Error(`Cannot sync entries: period ${normalizedPeriodNumber} does not exist for year ${yearId}`);
      }
      
      const entries = await client.getPaginated(`/accounting-years/${yearId}/periods/${apiPeriodNumber}/entries`);
      logger.info(`Found ${entries.length} accounting entries for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreementNumber}`);
      
      // Process entries in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const transformedEntries = batch.map(entry => 
          this.transformAccountingEntryData(entry, yearId, apiPeriodNumber, agreementNumber)
        );
        
        const result = await AccountingEntryModel.batchUpsert(transformedEntries);
        recordCount += result.inserted + result.updated;
      }
      
      await AccountingEntryModel.recordSyncLog(
        agreementNumber,
        yearId,
        normalizedPeriodNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting entries sync for period ${apiPeriodNumber} (normalized: ${normalizedPeriodNumber}), year ${yearId} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        yearId,
        period: normalizedPeriodNumber,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting entries for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreement.id}:`, error.message);
      
      const normalizedPeriodNumber = this.normalizePeriodNumber(apiPeriodNumber);
      await AccountingEntryModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        yearId,
        normalizedPeriodNumber,
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
  async syncAccountingTotalsForPeriod(agreement, yearId, apiPeriodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const normalizedPeriodNumber = this.normalizePeriodNumber(apiPeriodNumber);
      
      // Ensure period exists before adding totals
      const periodExists = await this.ensurePeriodExists(
        normalizedPeriodNumber, 
        yearId, 
        agreementNumber,
        null, null // Will be set with default dates
      );
      
      if (!periodExists) {
        throw new Error(`Cannot sync totals: period ${normalizedPeriodNumber} does not exist for year ${yearId}`);
      }
      
      const totals = await client.getPaginated(`/accounting-years/${yearId}/periods/${apiPeriodNumber}/totals`);
      logger.info(`Found ${totals.length} accounting totals for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreementNumber}`);
      
      if (totals.length > 0) {
        const transformedTotals = totals.map(total => 
          this.transformAccountingTotalData(total, yearId, apiPeriodNumber, agreementNumber)
        );
        
        const result = await AccountingTotalModel.batchUpsert(transformedTotals);
        recordCount = result.inserted + result.updated;
      }
      
      await AccountingTotalModel.recordSyncLog(
        agreementNumber,
        yearId,
        normalizedPeriodNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting totals sync for period ${apiPeriodNumber} (normalized: ${normalizedPeriodNumber}), year ${yearId} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        yearId,
        period: normalizedPeriodNumber,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting totals for period ${apiPeriodNumber}, year ${yearId} and agreement ${agreement.id}:`, error.message);
      
      const normalizedPeriodNumber = this.normalizePeriodNumber(apiPeriodNumber);
      await AccountingTotalModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        yearId,
        normalizedPeriodNumber,
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
  async syncAccountingTotalsForYear(agreement, yearId) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for year ${yearId} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Ensure period 0 exists for year totals
      const yearInfo = await AccountingYearModel.findByYearAndAgreement(yearId, agreementNumber);
      if (yearInfo) {
        await this.ensurePeriodExists(0, yearId, agreementNumber, yearInfo.start_date, yearInfo.end_date);
      }
      
      const totals = await client.getPaginated(`/accounting-years/${yearId}/totals`);
      logger.info(`Found ${totals.length} accounting totals for year ${yearId} and agreement ${agreementNumber}`);
      
      if (totals.length > 0) {
        const transformedTotals = totals.map(total => 
          this.transformAccountingTotalData(total, yearId, null, agreementNumber)
        );
        
        const result = await AccountingTotalModel.batchUpsert(transformedTotals);
        recordCount = result.inserted + result.updated;
      }
      
      await AccountingTotalModel.recordSyncLog(
        agreementNumber,
        yearId,
        0, // Use 0 for year totals
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounting totals sync for year ${yearId} and agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        yearId,
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounting totals for year ${yearId} and agreement ${agreement.id}:`, error.message);
      
      await AccountingTotalModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        yearId,
        0, // Use 0 for year totals
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