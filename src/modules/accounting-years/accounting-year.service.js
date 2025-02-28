const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const AccountingYearModel = require('./accounting-year.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AccountingYearService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API accounting year data to our database model
  transformAccountingYearData(year, agreementNumber) {
    return {
      year: year.year,
      agreement_number: agreementNumber,
      from_date: year.fromDate,
      to_date: year.toDate,
      closed: year.closed || false,
      self_url: year.self
    };
  }

  // Sync accounting years for a specific agreement
  async syncAccountingYearsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounting years sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const accountingYears = await client.getPaginated(endpoints.ACCOUNTING_YEARS);
      logger.info(`Found ${accountingYears.length} accounting years for agreement ${agreementNumber}`);
      
      for (const year of accountingYears) {
        const yearData = this.transformAccountingYearData(year, agreementNumber);
        await AccountingYearModel.upsert(yearData);
        recordCount++;
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

  // Sync accounting years across all agreements
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

  // Get accounting years by agreement
  async getAccountingYearsByAgreement(agreementNumber) {
    try {
      return await AccountingYearModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting accounting years for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get accounting year by year
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
}

module.exports = new AccountingYearService();