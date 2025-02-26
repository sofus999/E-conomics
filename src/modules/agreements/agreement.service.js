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
  
  // Create a new agreement with just a token
  async createAgreement(agreementData) {
    try {
      // If this is a token-only request, verify and populate data
      if (agreementData.agreement_grant_token && !agreementData.agreement_number) {
        return await this.createAgreementFromToken(agreementData.agreement_grant_token, 
          agreementData.is_active !== undefined ? agreementData.is_active : true);
      }
      
      // Regular create with provided data
      return await AgreementModel.create(agreementData);
    } catch (error) {
      logger.error('Error creating agreement:', error.message);
      throw error;
    }
  }
  
  // Create agreement from just a token
  async createAgreementFromToken(token, isActive = true) {
    try {
      // Validate token by testing
      const apiInfo = await this.testAgreementConnection(token);
      
      // Create agreement with verified data
      const agreementData = {
        name: apiInfo.companyName || 'Unknown Company',
        agreement_number: apiInfo.agreementNumber,
        agreement_grant_token: token,
        is_active: isActive
      };
      
      logger.info(`Creating agreement from API data: ${agreementData.name} (${agreementData.agreement_number})`);
      
      return await AgreementModel.create(agreementData);
    } catch (error) {
      logger.error('Error creating agreement from token:', error.message);
      throw error;
    }
  }
  
  // Update an agreement
  async updateAgreement(id, agreementData) {
    try {
      // If token is updated, validate it and get latest info
      if (agreementData.agreement_grant_token) {
        const apiInfo = await this.testAgreementConnection(agreementData.agreement_grant_token);
        
        // Populate with API data if not explicitly provided
        if (!agreementData.name && apiInfo.companyName) {
          agreementData.name = apiInfo.companyName;
        }
        
        if (!agreementData.agreement_number && apiInfo.agreementNumber) {
          agreementData.agreement_number = apiInfo.agreementNumber;
        }
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
  
  // Verify and update agreement data from API
  async verifyAndUpdateAgreement(id) {
    try {
      // Get current agreement
      const agreement = await AgreementModel.getById(id);
      
      // Test connection and get current API data
      const apiInfo = await this.testAgreementConnection(agreement.agreement_grant_token);
      
      // Update agreement with latest data
      const updatedData = {
        name: apiInfo.companyName || agreement.name,
        agreement_number: apiInfo.agreementNumber
      };
      
      // Update agreement details with correct name and number from API data
      if (updatedData.name !== agreement.name || updatedData.agreement_number !== agreement.agreement_number) {
        logger.info(`Updating agreement ${id} with latest API data`);
        return await AgreementModel.update(id, updatedData);
      }
      
      return agreement;
    } catch (error) {
      logger.error(`Error verifying/updating agreement ${id}:`, error.message);
      throw error;
    }
  }
}

module.exports = new AgreementService();