const logger = require('../core/logger');

// Import all services
const agreementService = require('../agreements/agreement.service');
const paymentTermsService = require('../payment-terms/payment-terms.service');
const productGroupService = require('../product-groups/product-group.service');
const productService = require('../products/product.service');
const vatAccountService = require('../vat-accounts/vat-account.service');
const invoiceService = require('../invoices/invoice.service');
const supplierGroupService = require('../supplier-groups/supplier-group.service');
const supplierService = require('../suppliers/supplier.service');

class SyncController {
  async syncAll(req, res, next) {
    const startTime = new Date();
    const results = {};
    
    try {
      logger.info('Starting complete data synchronization');
      
      // Sync in logical order (references before dependents)
      logger.info('1/8: Syncing payment terms...');
      results.paymentTerms = await paymentTermsService.syncAllPaymentTerms();
      
      logger.info('2/8: Syncing product groups...');
      results.productGroups = await productGroupService.syncAllProductGroups();
      
      logger.info('3/8: Syncing products...');
      results.products = await productService.syncAllProducts();
      
      logger.info('4/8: Syncing VAT accounts...');
      results.vatAccounts = await vatAccountService.syncAllVatAccounts();

      logger.info('5/8: Syncing supplier groups...');
      results.supplierGroups = await supplierGroupService.syncAllSupplierGroups();
      
      logger.info('6/8: Syncing suppliers...');
      results.suppliers = await supplierService.syncAllSuppliers();
      
      logger.info('7/8: Syncing invoices...');
      results.invoices = await invoiceService.syncAllInvoices();
      
      const endTime = new Date();
      const duration = endTime - startTime;
      
      logger.info(`Complete sync finished in ${duration}ms`);
      
      // Return summary of all operations
      res.json({
        status: 'success',
        duration,
        timestamp: new Date(),
        results: {
          paymentTerms: {
            count: results.paymentTerms?.totalCount || 0,
            status: results.paymentTerms?.status || 'unknown'
          },
          productGroups: {
            count: results.productGroups?.totalCount || 0,
            status: results.productGroups?.status || 'unknown'
          },
          products: {
            count: results.products?.totalCount || 0,
            status: results.products?.status || 'unknown'
          },
          supplierGroups: {
            count: results.supplierGroups?.totalCount || 0,
            status: results.supplierGroups?.status || 'unknown'
          },
          suppliers: {
            count: results.suppliers?.totalCount || 0,
            status: results.suppliers?.status || 'unknown'
          },
          vatAccounts: {
            count: results.vatAccounts?.totalCount || 0,
            status: results.vatAccounts?.status || 'unknown'
          },
          invoices: {
            count: results.invoices?.totalCount || 0,
            status: results.invoices?.status || 'unknown'
          }
        }
      });
    } catch (error) {
      logger.error('Error in complete sync:', error.message);
      next(error);
    }
  }
}

module.exports = new SyncController();