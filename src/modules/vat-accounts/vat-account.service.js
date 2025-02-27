const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const VatAccountModel = require('./vat-account.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class VatAccountService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API VAT account data to our database model
  transformVatAccountData(vatAccount, agreementNumber) {
    // Extract account number if it exists
    let accountNumber = null;
    if (vatAccount.account && vatAccount.account.accountNumber) {
      accountNumber = vatAccount.account.accountNumber;
    }
    
    // Extract contra account number if it exists
    let contraAccountNumber = null;
    if (vatAccount.contraAccount && vatAccount.contraAccount.accountNumber) {
      contraAccountNumber = vatAccount.contraAccount.accountNumber;
    }
    
    // Extract VAT type information
    let vatTypeNumber = null;
    let vatTypeName = null;
    if (vatAccount.vatType) {
      vatTypeNumber = vatAccount.vatType.vatTypeNumber;
      vatTypeName = vatAccount.vatType.name;
    }
    
    return {
      vat_code: vatAccount.vatCode,
      name: vatAccount.name,
      vat_percentage: vatAccount.ratePercentage,
      account_number: accountNumber,
      contra_account_number: contraAccountNumber,
      vat_type_number: vatTypeNumber,
      vat_type_name: vatTypeName,
      agreement_number: agreementNumber,
      self_url: vatAccount.self
    };
  }

  // Sync VAT accounts for a specific agreement
  async syncVatAccountsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting VAT accounts sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      // Create client for this agreement
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      
      // Get the agreement number directly from the API to confirm
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Fetch VAT accounts
      const vatAccounts = await client.getPaginated(endpoints.VAT_ACCOUNTS);
      logger.info(`Found ${vatAccounts.length} VAT accounts for agreement ${agreementNumber}`);
      
      // Process each VAT account
      for (const account of vatAccounts) {
        // Transform API data to our model
        const accountData = this.transformVatAccountData(account, agreementNumber);
        
        // Upsert the VAT account
        await VatAccountModel.upsert(accountData);
        
        recordCount++;
      }
      
      // Record successful sync
      await VatAccountModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed VAT accounts sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing VAT accounts for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await VatAccountModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync VAT accounts across all agreements
  async syncAllVatAccounts() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of VAT accounts across all agreements');
      
      // Get all active agreements
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
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncVatAccountsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing VAT accounts for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed VAT accounts sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall VAT accounts sync process:', error.message);
      throw error;
    }
  }

  // Get VAT accounts by agreement
  async getVatAccountsByAgreement(agreementNumber) {
    try {
      return await VatAccountModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting VAT accounts for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get VAT account by code
  async getVatAccountByCode(vatCode, agreementNumber) {
    try {
      const account = await VatAccountModel.findByCodeAndAgreement(vatCode, agreementNumber);
      
      if (!account) {
        throw ApiError.notFound(`VAT account with code ${vatCode} not found for agreement ${agreementNumber}`);
      }
      
      return account;
    } catch (error) {
      logger.error(`Error getting VAT account ${vatCode} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new VatAccountService();