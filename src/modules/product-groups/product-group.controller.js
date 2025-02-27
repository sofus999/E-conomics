const productGroupService = require('./product-group.service');
const logger = require('../core/logger');

class ProductGroupController {
  // Sync product groups for all agreements
  async syncProductGroups(req, res, next) {
    try {
      const result = await productGroupService.syncAllProductGroups();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync product groups for a specific agreement
  async syncProductGroupsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await productGroupService.syncProductGroupsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get product groups for an agreement
  async getProductGroups(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const groups = await productGroupService.getProductGroupsByAgreement(parseInt(agreement_number));
      res.json(groups);
    } catch (error) {
      next(error);
    }
  }
  
  // Get product group by number
  async getProductGroupByNumber(req, res, next) {
    try {
      const { agreement_number, group_number } = req.params;
      const group = await productGroupService.getProductGroupByNumber(parseInt(group_number), parseInt(agreement_number));
      res.json(group);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductGroupController();