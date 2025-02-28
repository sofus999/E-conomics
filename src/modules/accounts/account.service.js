const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const AccountModel = require('./account.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AccountService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformAccountData(account, agreementNumber) {
    let vatCode = null;
    if (account.vatAccount && account.vatAccount.vatCode) {
      vatCode = account.vatAccount.vatCode;
    }
    
    return {
      account_number: account.accountNumber,
      agreement_number: agreementNumber,
      account_type: account.accountType,
      name: account.name,
      balance: account.balance || 0.00,
      debit_credit: account.debitCredit,
      block_direct_entries: account.blockDirectEntries || false,
      vat_code: vatCode,
      self_url: account.self
    };
  }

  async syncAccountsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting accounts sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const accounts = await client.getPaginated(endpoints.ACCOUNTS);
      logger.info(`Found ${accounts.length} accounts for agreement ${agreementNumber}`);
      
      for (const account of accounts) {
        const accountData = this.transformAccountData(account, agreementNumber);
        await AccountModel.upsert(accountData);
        recordCount++;
      }
      
      await AccountModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed accounts sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing accounts for agreement ${agreement.id}:`, error.message);
      
      await AccountModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAllAccounts() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of accounts across all agreements');
      
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
          const result = await this.syncAccountsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing accounts for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed accounts sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall accounts sync process:', error.message);
      throw error;
    }
  }

  async getAccountsByAgreement(agreementNumber) {
    try {
      return await AccountModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting accounts for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getAccountByNumber(accountNumber, agreementNumber) {
    try {
      const account = await AccountModel.findByNumberAndAgreement(accountNumber, agreementNumber);
      
      if (!account) {
        throw ApiError.notFound(`Account with number ${accountNumber} not found for agreement ${agreementNumber}`);
      }
      
      return account;
    } catch (error) {
      logger.error(`Error getting account ${accountNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new AccountService();