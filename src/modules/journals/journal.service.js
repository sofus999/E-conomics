const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const JournalModel = require('./journal.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class JournalService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformJournalData(journal, agreementNumber) {
    let minVoucherNumber = null;
    let maxVoucherNumber = null;
    let entryTypeRestrictedTo = null;
    let settings = {};

    if (journal.settings) {
      if (journal.settings.voucherNumbers) {
        minVoucherNumber = journal.settings.voucherNumbers.minimumVoucherNumber;
        maxVoucherNumber = journal.settings.voucherNumbers.maximumVoucherNumber;
      }
      
      if (journal.settings.entryTypeRestrictedTo) {
        entryTypeRestrictedTo = journal.settings.entryTypeRestrictedTo;
      }
      
      settings = journal.settings;
    }

    return {
      journal_number: journal.journalNumber,
      agreement_number: agreementNumber,
      name: journal.name,
      min_voucher_number: minVoucherNumber,
      max_voucher_number: maxVoucherNumber,
      entry_type_restricted_to: entryTypeRestrictedTo,
      settings: settings,
      self_url: journal.self
    };
  }

  async syncJournalsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting journals sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const journals = await client.getPaginated(endpoints.JOURNALS);
      logger.info(`Found ${journals.length} journals for agreement ${agreementNumber}`);
      
      for (const journal of journals) {
        const journalData = this.transformJournalData(journal, agreementNumber);
        await JournalModel.upsert(journalData);
        recordCount++;
      }
      
      await JournalModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed journals sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing journals for agreement ${agreement.id}:`, error.message);
      
      await JournalModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAllJournals() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of journals across all agreements');
      
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
          const result = await this.syncJournalsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing journals for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed journals sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall journals sync process:', error.message);
      throw error;
    }
  }

  async getJournalsByAgreement(agreementNumber) {
    try {
      return await JournalModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting journals for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getJournalByNumber(journalNumber, agreementNumber) {
    try {
      const journal = await JournalModel.findByNumberAndAgreement(journalNumber, agreementNumber);
      
      if (!journal) {
        throw ApiError.notFound(`Journal with number ${journalNumber} not found for agreement ${agreementNumber}`);
      }
      
      return journal;
    } catch (error) {
      logger.error(`Error getting journal ${journalNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new JournalService();