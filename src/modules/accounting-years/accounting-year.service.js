const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const AccountingYearModel = require('./accounting-year.model');
const AccountingPeriodModel = require('./accounting-period.model');
const AccountingEntryModel = require('./accounting-entry.model');
const AccountingTotalModel = require('./accounting-total.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

// Simple in-memory cache
const cache = {
  data: {},
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    
    // Check if cache is expired (30 minutes)
    if (Date.now() - item.timestamp > 30 * 60 * 1000) {
      delete this.data[key];
      return null;
    }
    
    return item.value;
  },
  set(key, value, ttlMinutes = 30) {
    this.data[key] = {
      value,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
  },
  clear(pattern) {
    if (!pattern) {
      this.data = {};
      return;
    }
    
    Object.keys(this.data).forEach(key => {
      if (key.includes(pattern)) {
        delete this.data[key];
      }
    });
  }
};

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
      // Use 0 for year totals instead of null
      period_number: periodNumber || 0,
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
      
      // Clear cache for this agreement's accounting data
      cache.clear(`accounting_${agreementNumber}`);
      
      for (const year of accountingYears) {
        const yearData = this.transformAccountingYearData(year, agreementNumber);
        await AccountingYearModel.upsert(yearData);
        recordCount++;
        
        // Always sync periods since they're lightweight
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
      
      // Clear cache for this year's period data
      cache.clear(`accounting_${agreementNumber}_${year}`);
      
      for (const period of periods) {
        const periodData = this.transformAccountingPeriodData(period, year, agreementNumber);
        await AccountingPeriodModel.upsert(periodData);
        recordCount++;
        
        // For year totals, sync immediately (they're small)
        await this.syncAccountingTotalsForYear(agreement, year);
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

  async syncAccountingEntriesForPeriod(agreement, year, periodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting entries sync for period ${periodNumber}, year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Check last sync time to implement incremental sync
      const lastSyncLog = await db.query(
        `SELECT * FROM sync_logs 
         WHERE entity = ? AND status = 'success' 
         ORDER BY completed_at DESC LIMIT 1`,
        [`accounting_entries_${year}_${periodNumber}_${agreementNumber}`]
      );
      
      const needsFullSync = lastSyncLog.length === 0;
      
      // Clear cache for this period's entry data
      cache.clear(`accounting_${agreementNumber}_${year}_${periodNumber}`);
      
      const entries = await client.getPaginated(`/accounting-years/${year}/periods/${periodNumber}/entries`);
      logger.info(`Found ${entries.length} accounting entries for period ${periodNumber}, year ${year} and agreement ${agreementNumber}`);
      
      // Transform entries in batches to avoid memory issues
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

  async syncAccountingTotalsForPeriod(agreement, year, periodNumber) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for period ${periodNumber}, year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Clear cache for this period's total data
      cache.clear(`accounting_totals_${agreementNumber}_${year}_${periodNumber}`);
      
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

  async syncAccountingTotalsForYear(agreement, year) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting totals sync for year ${year} and agreement ${agreement.name}`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Clear cache for this year's total data
      cache.clear(`accounting_totals_${agreementNumber}_${year}`);
      
      const totals = await client.getPaginated(`/accounting-years/${year}/totals`);
      logger.info(`Found ${totals.length} accounting totals for year ${year} and agreement ${agreementNumber}`);
      
      // Explicit NULL for period_number to ensure it's properly handled
      const transformedTotals = totals.map(total => 
        this.transformAccountingTotalData(total, year, null, agreementNumber)
      );
      
      logger.info(`Transformed ${transformedTotals.length} accounting totals for year ${year}`);
      
      // Log a sample for debugging
      if (transformedTotals.length > 0) {
        logger.debug('Sample total data:', JSON.stringify(transformedTotals[0]));
      }
      
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
      // Try to get from cache first
      const cacheKey = `accounting_${agreementNumber}_years`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      const years = await AccountingYearModel.getByAgreement(agreementNumber);
      
      // Store in cache
      cache.set(cacheKey, years);
      
      return years;
    } catch (error) {
      logger.error(`Error getting accounting years for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getAccountingYearByYear(year, agreementNumber) {
    try {
      // Try to get from cache first
      const cacheKey = `accounting_${agreementNumber}_year_${year}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      const accountingYear = await AccountingYearModel.findByYearAndAgreement(year, agreementNumber);
      
      if (!accountingYear) {
        throw ApiError.notFound(`Accounting year ${year} not found for agreement ${agreementNumber}`);
      }
      
      // Store in cache
      cache.set(cacheKey, accountingYear);
      
      return accountingYear;
    } catch (error) {
      logger.error(`Error getting accounting year ${year} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  async getAccountingPeriodsByYear(year, agreementNumber) {
    try {
      // Try to get from cache first
      const cacheKey = `accounting_${agreementNumber}_${year}_periods`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      const periods = await AccountingPeriodModel.getByYearAndAgreement(year, agreementNumber);
      
      // Store in cache
      cache.set(cacheKey, periods);
      
      return periods;
    } catch (error) {
      logger.error(`Error getting accounting periods for year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  async getAccountingPeriodByNumber(periodNumber, year, agreementNumber) {
    try {
      // Try to get from cache first
      const cacheKey = `accounting_${agreementNumber}_${year}_period_${periodNumber}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      const period = await AccountingPeriodModel.findByNumberYearAndAgreement(periodNumber, year, agreementNumber);
      
      if (!period) {
        throw ApiError.notFound(`Accounting period ${periodNumber} not found for year ${year} and agreement ${agreementNumber}`);
      }
      
      // Store in cache
      cache.set(cacheKey, period);
      
      return period;
    } catch (error) {
      logger.error(`Error getting accounting period ${periodNumber} for year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  async getAccountingEntriesByPeriod(periodNumber, year, agreementNumber, pagination = { page: 1, limit: 100 }) {
    try {
      // For entries, we'll only cache the first page with default limit to save memory
      const isDefaultPage = pagination.page === 1 && pagination.limit === 100;
      const cacheKey = `accounting_${agreementNumber}_${year}_${periodNumber}_entries`;
      
      if (isDefaultPage) {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // Check if we have data for this period
      const period = await this.getAccountingPeriodByNumber(periodNumber, year, agreementNumber);
      
      // Get entries (this is paginated)
      const entries = await AccountingEntryModel.getByPeriodYearAndAgreement(
        periodNumber, 
        year, 
        agreementNumber,
        pagination
      );
      
      // If no entries found and default page, trigger on-demand sync
      if (entries.data.length === 0 && isDefaultPage) {
        const agreement = await AgreementModel.getByAgreementNumber(agreementNumber);
        if (agreement) {
          // Don't await this to allow returning empty results quickly
          this.syncAccountingEntriesForPeriod(agreement, year, periodNumber)
            .catch(error => logger.error(`Background sync failed for period ${periodNumber}:`, error.message));
          
          // Let the user know data is being fetched
          entries.syncing = true;
        }
      }
      
      if (isDefaultPage) {
        // Cache only the first page
        cache.set(cacheKey, entries);
      }
      
      return entries;
    } catch (error) {
      logger.error(`Error getting accounting entries for period ${periodNumber}, year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  async getAccountingTotalsByPeriod(periodNumber, year, agreementNumber) {
    try {
      // Try to get from cache first
      const cacheKey = `accounting_totals_${agreementNumber}_${year}_${periodNumber}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      // Check if we have data for this period
      const period = await this.getAccountingPeriodByNumber(periodNumber, year, agreementNumber);
      
      // Get totals
      const totals = await AccountingTotalModel.getByPeriodYearAndAgreement(periodNumber, year, agreementNumber);
      
      // If no totals found, trigger on-demand sync
      if (totals.length === 0) {
        const agreement = await AgreementModel.getByAgreementNumber(agreementNumber);
        if (agreement) {
          // Don't await this to allow returning empty results quickly
          this.syncAccountingTotalsForPeriod(agreement, year, periodNumber)
            .catch(error => logger.error(`Background sync failed for period ${periodNumber}:`, error.message));
          
          // Return what we have with syncing indicator
          return { data: totals, syncing: true };
        }
      }
      
      // Store in cache
      cache.set(cacheKey, totals);
      
      return totals;
    } catch (error) {
      logger.error(`Error getting accounting totals for period ${periodNumber}, year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
  
  async getAccountingTotalsByYear(year, agreementNumber) {
    try {
      // Try to get from cache first
      const cacheKey = `accounting_totals_${agreementNumber}_${year}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      // Check if we have data for this year
      await this.getAccountingYearByYear(year, agreementNumber);
      
      // Get totals
      const totals = await AccountingTotalModel.getByYearAndAgreement(year, agreementNumber);
      
      // If no totals found, trigger on-demand sync
      if (totals.length === 0) {
        const agreement = await AgreementModel.getByAgreementNumber(agreementNumber);
        if (agreement) {
          // Don't await this to allow returning empty results quickly
          this.syncAccountingTotalsForYear(agreement, year)
            .catch(error => logger.error(`Background sync failed for year ${year}:`, error.message));
          
          // Return what we have with syncing indicator
          return { data: totals, syncing: true };
        }
      }
      
      // Store in cache
      cache.set(cacheKey, totals);
      
      return totals;
    } catch (error) {
      logger.error(`Error getting accounting totals for year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new AccountingYearService();