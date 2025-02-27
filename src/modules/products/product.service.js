const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const ProductModel = require('./product.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class ProductService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API product data to our database model
  transformProductData(product, agreementNumber) {
    // Extract product group number if it exists
    let productGroupNumber = null;
    if (product.productGroup && product.productGroup.productGroupNumber) {
      productGroupNumber = product.productGroup.productGroupNumber;
    }
    
    // Parse last updated date
    let lastUpdated = null;
    if (product.lastUpdated) {
      lastUpdated = new Date(product.lastUpdated);
    }
    
    return {
      product_number: product.productNumber,
      name: product.name,
      agreement_number: agreementNumber,
      product_group_number: productGroupNumber,
      description: product.description,
      unit: product.unit,
      price: product.salesPrice || 0,
      cost_price: product.costPrice || 0,
      recommended_price: product.recommendedPrice || 0,
      is_accessible: !product.barred,
      inventory: product.inventory || 0,
      barred: product.barred || false,
      last_updated: lastUpdated,
      self_url: product.self
    };
  }

  // Sync products for a specific agreement
  async syncProductsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting products sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      // Create client for this agreement
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      
      // Get the agreement number directly from the API to confirm
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Fetch products
      const products = await client.getPaginated(endpoints.PRODUCTS);
      logger.info(`Found ${products.length} products for agreement ${agreementNumber}`);
      
      // Process each product
      for (const product of products) {
        // Transform API data to our model
        const productData = this.transformProductData(product, agreementNumber);
        
        // Upsert the product
        productData.agreement_number = agreementNumber;
        await ProductModel.upsert(productData);
        
        recordCount++;
      }
      
      // Record successful sync
      await ProductModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed products sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing products for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await ProductModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync products across all agreements
  async syncAllProducts() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of products across all agreements');
      
      // Get all active agreements
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
      
      // Process each agreement
      for (const agreement of agreements) {
        try {
          const result = await this.syncProductsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing products for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed products sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall products sync process:', error.message);
      throw error;
    }
  }

  // Get products with filtering, sorting, and pagination
  async getProducts(agreementNumber, filters = {}, sort = {}, pagination = {}) {
    try {
      return await ProductModel.find(agreementNumber, filters, sort, pagination);
    } catch (error) {
      logger.error(`Error getting products for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get product by number
  async getProductByNumber(productNumber, agreementNumber) {
    try {
      const product = await ProductModel.findByNumberAndAgreement(productNumber, agreementNumber);
      
      if (!product) {
        throw ApiError.notFound(`Product with number ${productNumber} not found for agreement ${agreementNumber}`);
      }
      
      return product;
    } catch (error) {
      logger.error(`Error getting product ${productNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new ProductService();