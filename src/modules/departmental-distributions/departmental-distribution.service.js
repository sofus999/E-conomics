const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const DepartmentalDistributionModel = require('./departmental-distribution.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class DepartmentalDistributionService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformDistributionData(distribution, agreementNumber) {
    return {
      departmental_distribution_number: distribution.departmentalDistributionNumber,
      agreement_number: agreementNumber,
      name: distribution.name,
      barred: distribution.barred || false,
      distribution_type: distribution.DistributionType,
      self_url: distribution.self
    };
  }

  async syncDistributionsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting departmental distributions sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const distributions = await client.getPaginated(endpoints.DEPARTMENTAL_DISTRIBUTIONS);
      logger.info(`Found ${distributions.length} departmental distributions for agreement ${agreementNumber}`);
      
      for (const distribution of distributions) {
        // Create or update the main distribution record
        const distributionData = this.transformDistributionData(distribution, agreementNumber);
        await DepartmentalDistributionModel.upsert(distributionData);
        
        // Clear existing percentages
        await DepartmentalDistributionModel.clearDistributionPercentages(
          distributionData.departmental_distribution_number, 
          agreementNumber
        );
        
        // Add new percentages
        if (distribution.distributions && Array.isArray(distribution.distributions)) {
          for (const item of distribution.distributions) {
            if (item.department && item.percentage) {
              await DepartmentalDistributionModel.saveDistributionPercentage({
                departmental_distribution_number: distributionData.departmental_distribution_number,
                agreement_number: agreementNumber,
                department_number: item.department.departmentNumber,
                percentage: item.percentage
              });
            }
          }
        }
        
        recordCount++;
      }
      
      await DepartmentalDistributionModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed departmental distributions sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing departmental distributions for agreement ${agreement.id}:`, error.message);
      
      await DepartmentalDistributionModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAllDistributions() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of departmental distributions across all agreements');
      
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
          const result = await this.syncDistributionsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing departmental distributions for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed departmental distributions sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall departmental distributions sync process:', error.message);
      throw error;
    }
  }

  async getDistributionsByAgreement(agreementNumber) {
    try {
      const distributions = await DepartmentalDistributionModel.getByAgreement(agreementNumber);
      
      // Enhance with percentage information
      for (let i = 0; i < distributions.length; i++) {
        distributions[i].percentages = await DepartmentalDistributionModel.getDistributionPercentages(
          distributions[i].departmental_distribution_number,
          agreementNumber
        );
      }
      
      return distributions;
    } catch (error) {
      logger.error(`Error getting departmental distributions for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getDistributionByNumber(distributionNumber, agreementNumber) {
    try {
      const distribution = await DepartmentalDistributionModel.findByNumberAndAgreement(
        distributionNumber, 
        agreementNumber
      );
      
      if (!distribution) {
        throw ApiError.notFound(`Departmental distribution with number ${distributionNumber} not found for agreement ${agreementNumber}`);
      }
      
      // Enhance with percentage information
      distribution.percentages = await DepartmentalDistributionModel.getDistributionPercentages(
        distributionNumber,
        agreementNumber
      );
      
      return distribution;
    } catch (error) {
      logger.error(`Error getting departmental distribution ${distributionNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new DepartmentalDistributionService();