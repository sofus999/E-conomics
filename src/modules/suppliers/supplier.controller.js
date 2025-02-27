const supplierService = require('./supplier.service');
const logger = require('../core/logger');

class SupplierController {
  // Sync suppliers for all agreements
  async syncSuppliers(req, res, next) {
    try {
      const result = await supplierService.syncAllSuppliers();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync suppliers for a specific agreement
  async syncSuppliersForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await supplierService.syncSuppliersForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get suppliers with filtering
  async getSuppliers(req, res, next) {
    try {
      const { agreement_number } = req.params;
      
      // Extract query parameters
      const {
        supplier_group_number,
        name,
        city,
        country,
        barred,
        sort_by,
        sort_order,
        page,
        limit
      } = req.query;
      
      // Build filters object
      const filters = {};
      
      if (supplier_group_number) filters.supplier_group_number = parseInt(supplier_group_number);
      if (name) filters.name = name;
      if (city) filters.city = city;
      if (country) filters.country = country;
      if (barred !== undefined) filters.barred = barred === 'true';
      
      // Build sort object
      const sort = {
        field: sort_by || 'name',
        order: sort_order || 'ASC'
      };
      
      // Build pagination object
      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      };
      
      const result = await supplierService.getSuppliers(
        parseInt(agreement_number),
        filters,
        sort,
        pagination
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get supplier by number
  async getSupplierByNumber(req, res, next) {
    try {
      const { agreement_number, supplier_number } = req.params;
      const supplier = await supplierService.getSupplierByNumber(parseInt(supplier_number), parseInt(agreement_number));
      res.json(supplier);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupplierController();
