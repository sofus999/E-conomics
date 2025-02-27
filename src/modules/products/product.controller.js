const productService = require('./product.service');
const logger = require('../core/logger');

class ProductController {
  // Sync products for all agreements
  async syncProducts(req, res, next) {
    try {
      const result = await productService.syncAllProducts();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Sync products for a specific agreement
  async syncProductsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      // Get agreement by ID
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await productService.syncProductsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Get products with filtering
  async getProducts(req, res, next) {
    try {
      const { agreement_number } = req.params;
      
      // Extract query parameters
      const {
        product_group_number,
        name,
        barred,
        sort_by,
        sort_order,
        page,
        limit
      } = req.query;
      
      // Build filters object
      const filters = {};
      
      if (product_group_number) filters.product_group_number = parseInt(product_group_number);
      if (name) filters.name = name;
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
      
      const result = await productService.getProducts(
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
  
  // Get product by number
  async getProductByNumber(req, res, next) {
    try {
      const { agreement_number, product_number } = req.params;
      const product = await productService.getProductByNumber(product_number, parseInt(agreement_number));
      res.json(product);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();