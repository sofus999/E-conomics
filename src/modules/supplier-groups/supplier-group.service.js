const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const SupplierGroupModel = require('./supplier-group.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');

class SupplierGroupService {
  transformGroupData(group, agreementNumber) {
    return {
      supplier_group_number: group.supplierGroupNumber,
      agreement_number: agreementNumber,
      name: group.name,
      account_number: group.account?.accountNumber?.toString() ?? null,
      suppliers_count: 0,
      self_url: group.self
    };
  }

  async syncGroupsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting supplier groups sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = ApiClient.forAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Use getPaginated to handle pagination
      const groups = await client.getPaginated(endpoints.SUPPLIER_GROUPS);
      logger.debug(`Raw supplier groups response:`, groups); // Add debug logging
      logger.info(`Found ${groups.length} supplier groups for agreement ${agreementNumber}`);
      
      for (const group of groups) {
        const groupData = this.transformGroupData(group, agreementNumber);
        logger.debug(`Transformed group data:`, groupData); // Add debug logging
        await SupplierGroupModel.upsert(groupData);
        recordCount++;
      }
      
      await SupplierGroupModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing supplier groups for agreement ${agreement.id}:`, error.message);
      throw error;
    }
  }

  async syncAllSupplierGroups() {
    const startTime = new Date();
    const results = [];
    let totalCount = 0;
    
    try {
      const agreements = await AgreementModel.getAll(true);
      
      for (const agreement of agreements) {
        try {
          const result = await this.syncGroupsForAgreement(agreement);
          results.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing supplier groups for agreement ${agreement.name}:`, error.message);
        }
      }
      
      return {
        status: 'success',
        results,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall supplier groups sync process:', error.message);
      throw error;
    }
  }
}

module.exports = new SupplierGroupService();