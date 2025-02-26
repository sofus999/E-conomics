const AgreementModel = require('./agreement.model');
const ApiClient = require('../../api/client');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AgreementService {
  // Get all agreements
  async getAllAgreements(activeOnly = true) {
    try {
      return await AgreementModel.getAll(activeOnly);
    } catch (error) {
      logger.error('Error getting all agreements:', error.message);
      throw error;
    }
  }
  
  // Get agreement by ID
  async getAgreementById(id) {
    try {
      return await AgreementModel.getById(id);
    } catch (error) {
      logger.error(`Error getting agreement ${id}:`, error.message);
      throw error;
    }
  }
  
  // Create a new agreement
  async createAgreement(agreementData) {
    try {
      // Validate agreement token by testing it
      await this.testAgreementConnection(agreementData.agreement_grant_token);
      
      return await AgreementModel.create(agreementData);
    } catch (error) {
      logger.error('Error creating agreement:', error.message);
      throw error;
    }
  }
  
  async createAgreementWithVerification(agreementData) {
    try {
      // First test connection & get actual data from API
      const apiInfo = await this.testAgreementConnection(agreementData.agreement_grant_token);
      
      // Create complete data with verified values
      const verifiedData = {
        name: apiInfo.companyName || agreementData.name,
        agreement_number: apiInfo.agreementNumber,
        agreement_grant_token: agreementData.agreement_grant_token,
        is_active: agreementData.is_active !== undefined ? agreementData.is_active : true
      };
      
      return await AgreementModel.create(verifiedData);
    } catch (error) {
      logger.error('Error creating verified agreement:', error.message);
      throw error;
    }
  }
  // Update an agreement
  async updateAgreement(id, agreementData) {
    try {
      // If token is updated, validate it
      if (agreementData.agreement_grant_token) {
        await this.testAgreementConnection(agreementData.agreement_grant_token);
      }
      
      return await AgreementModel.update(id, agreementData);
    } catch (error) {
      logger.error(`Error updating agreement ${id}:`, error.message);
      throw error;
    }
  }
  
  // Delete an agreement
  async deleteAgreement(id) {
    try {
      return await AgreementModel.delete(id);
    } catch (error) {
      logger.error(`Error deleting agreement ${id}:`, error.message);
      throw error;
    }
  }
  
  // Test agreement connection
  async testAgreementConnection(agreementGrantToken) {
    try {
      const client = ApiClient.forAgreement(agreementGrantToken);
      const info = await client.getAgreementInfo();
      
      if (!info.agreementNumber) {
        throw ApiError.badRequest('Invalid agreement token - could not get agreement number');
      }
      
      return info;
    } catch (error) {
      logger.error('Error testing agreement connection:', error.message);
      throw ApiError.badRequest(`Invalid agreement token: ${error.message}`);
    }
  }
}

module.exports = new AgreementService();