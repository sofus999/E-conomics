const departmentalDistributionService = require('./departmental-distribution.service');
const logger = require('../core/logger');

class DepartmentalDistributionController {
  async syncDistributions(req, res, next) {
    try {
      const result = await departmentalDistributionService.syncAllDistributions();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncDistributionsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await departmentalDistributionService.syncDistributionsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async getDistributions(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const distributions = await departmentalDistributionService.getDistributionsByAgreement(parseInt(agreement_number));
      res.json(distributions);
    } catch (error) {
      next(error);
    }
  }
  
  async getDistributionByNumber(req, res, next) {
    try {
      const { agreement_number, distribution_number } = req.params;
      const distribution = await departmentalDistributionService.getDistributionByNumber(
        parseInt(distribution_number), 
        parseInt(agreement_number)
      );
      res.json(distribution);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DepartmentalDistributionController();