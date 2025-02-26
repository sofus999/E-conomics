const agreementService = require('./agreement.service');
const logger = require('../core/logger');

class AgreementController {
  // Get all agreements
  async getAllAgreements(req, res, next) {
    try {
      const { active_only } = req.query;
      const activeOnly = active_only !== 'false'; // Default true
      
      const agreements = await agreementService.getAllAgreements(activeOnly);
      res.json(agreements);
    } catch (error) {
      next(error);
    }
  }
  
  // Get agreement by ID
  async getAgreementById(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await agreementService.getAgreementById(id);
      res.json(agreement);
    } catch (error) {
      next(error);
    }
  }
  
  // Create a new agreement
  async createAgreement(req, res, next) {
    try {
      const agreementData = req.body;
      const newAgreement = await agreementService.createAgreement(agreementData);
      res.status(201).json(newAgreement);
    } catch (error) {
      next(error);
    }
  }
  
  // Update an agreement
  async updateAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreementData = req.body;
      const updatedAgreement = await agreementService.updateAgreement(id, agreementData);
      res.json(updatedAgreement);
    } catch (error) {
      next(error);
    }
  }
  
  // Delete an agreement
  async deleteAgreement(req, res, next) {
    try {
      const { id } = req.params;
      await agreementService.deleteAgreement(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
  
  // Test agreement connection
  async testAgreementConnection(req, res, next) {
    try {
      const token = req.body.agreement_grant_token;
      
      if (!token) {
        res.status(400).json({ 
          error: { 
            message: 'Missing agreement_grant_token in request body',
            code: 'MISSING_TOKEN'
          } 
        });
        return;
      }
      
      const info = await agreementService.testAgreementConnection(token);
      res.json({
        status: 'success',
        agreement_number: info.agreementNumber,
        company_name: info.companyName
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AgreementController();