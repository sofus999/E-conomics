const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const DepartmentModel = require('./department.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class DepartmentService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformDepartmentData(department, agreementNumber) {
    return {
      department_number: department.departmentNumber,
      agreement_number: agreementNumber,
      name: department.name,
      self_url: department.self
    };
  }

  async syncDepartmentsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting departments sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const departments = await client.getPaginated(endpoints.DEPARTMENTS);
      logger.info(`Found ${departments.length} departments for agreement ${agreementNumber}`);
      
      for (const department of departments) {
        const departmentData = this.transformDepartmentData(department, agreementNumber);
        await DepartmentModel.upsert(departmentData);
        recordCount++;
      }
      
      await DepartmentModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed departments sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing departments for agreement ${agreement.id}:`, error.message);
      
      await DepartmentModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAllDepartments() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of departments across all agreements');
      
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
          const result = await this.syncDepartmentsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing departments for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed departments sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall departments sync process:', error.message);
      throw error;
    }
  }

  async getDepartmentsByAgreement(agreementNumber) {
    try {
      return await DepartmentModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting departments for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getDepartmentByNumber(departmentNumber, agreementNumber) {
    try {
      const department = await DepartmentModel.findByNumberAndAgreement(departmentNumber, agreementNumber);
      
      if (!department) {
        throw ApiError.notFound(`Department with number ${departmentNumber} not found for agreement ${agreementNumber}`);
      }
      
      return department;
    } catch (error) {
      logger.error(`Error getting department ${departmentNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new DepartmentService();