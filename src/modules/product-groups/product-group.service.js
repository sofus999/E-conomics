const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const ProductGroupModel = require('./product-group.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class ProductGroupService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API product group data to our database model
  transformProductGroupData(group, agreementNumber) {
    // Extract account number if it exists
    let accountNumber = null;
    if (group.account && group.account.accountNumber) {
      accountNumber = group.account.accountNumber;
    }
    
    // Extract accrual account number if it exists
    let accrualAccountNumber = null;
    if (group.accrual && group.accrual.accountNumber) {
      accrualAccountNumber = group.accrual.accountNumber;
    }
    
    return {
      product_group_number: group.productGroupNumber,
      name: group.name,
      agreement_number: agreementNumber,
      account_number: accountNumber,
      accrual_account_number: accrualAccountNumber,
      // Extract product count from URL or set default
      products_count: 0, // Will be updated after products sync
      self_url: group.self
    };
  }

  // Sync product groups for a specific agreement
  async syncProductGroupsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting product groups sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      // Create client for this agreement
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      
      // Get the agreement number directly from the API to confirm
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Fetch product groups
      const productGroups = await client.getPaginated(endpoints.PRODUCT_GROUPS);
      logger.info(`Found ${productGroups.length} product groups for agreement ${agreementNumber}`);
      
      // Process each product group
      for (const group of productGroups) {
        // Transform API data to our model
        const groupData = this.transformProductGroupData(group, agreementNumber);
        
        // Upsert the product group
        await ProductGroupModel.upsert(groupData);
        
        recordCount++;
      }
      
      // Record successful sync
      await ProductGroupModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed product groups sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing product groups for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await ProductGroupModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync product groups across all agreements
  async syncAllProductGroups() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of product groups across all agreements');
      
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
          const result = await this.syncProductGroupsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing product groups for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed product groups sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall product groups sync process:', error.message);
      throw error;
    }
  }

  // Get product groups for an agreement
  async getProductGroupsByAgreement(agreementNumber) {
    try {
      return await ProductGroupModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting product groups for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get product group by number
  async getProductGroupByNumber(productGroupNumber, agreementNumber) {
    try {
      const group = await ProductGroupModel.findByNumberAndAgreement(productGroupNumber, agreementNumber);
      
      if (!group) {
        throw ApiError.notFound(`Product group with number ${productGroupNumber} not found for agreement ${agreementNumber}`);
      }
      
      return group;
    } catch (error) {
      logger.error(`Error getting product group ${productGroupNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new ProductGroupService();