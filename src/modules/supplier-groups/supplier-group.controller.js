const supplierGroupService = require('./supplier-group.service');
const logger = require('../core/logger');

class SupplierGroupController {
  // Sync supplier groups for all agreements
  async syncSupplierGroups(req, res, next) {
    try {
      const result = await supplierGroupService.syncAllSupplierGroups();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync supplier groups for a specific agreement
  async syncSupplierGroupsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await supplierGroupService.syncSupplierGroupsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get supplier groups for an agreement
  async getSupplierGroups(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const groups = await supplierGroupService.getSupplierGroupsByAgreement(parseInt(agreement_number));
      res.json(groups);
    } catch (error) {
      next(error);
    }
  }
  
  // Get supplier group by number
  async getSupplierGroupByNumber(req, res, next) {
    try {
      const { agreement_number, group_number } = req.params;
      const group = await supplierGroupService.getSupplierGroupByNumber(parseInt(group_number), parseInt(agreement_number));
      res.json(group);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupplierGroupController();