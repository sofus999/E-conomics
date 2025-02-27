const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const SupplierModel = require('./supplier.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class SupplierService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API supplier data to our database model
  transformSupplierData(supplier, agreementNumber) {
    return {
      supplier_number: supplier.supplierNumber,
      agreement_number: agreementNumber,
      name: supplier.name,
      supplier_group_number: supplier.supplierGroup?.supplierGroupNumber ?? null,
      address: supplier.address ?? null,
      zip: supplier.zip ?? null,
      city: supplier.city ?? null,
      country: supplier.country ?? null,
      email: supplier.email ?? null,
      phone: supplier.phone ?? null,
      currency: supplier.currency ?? null,
      payment_terms_number: supplier.paymentTerms?.paymentTermsNumber ?? null,
      vat_number: supplier.vatNumber ?? null,
      corp_identification_number: supplier.corporateIdentificationNumber ?? null,
      default_delivery_location: supplier.defaultDeliveryLocation ?? null,
      barred: supplier.barred ?? false,
      creditor_id: supplier.remittanceAdvice?.creditorId ?? null,
      payment_type_number: supplier.remittanceAdvice?.paymentType?.paymentTypeNumber ?? null,
      cost_account_number: supplier.costAccount?.accountNumber?.toString() ?? null,
      self_url: supplier.self ?? null
    };
  }

  // Sync suppliers for a specific agreement
  async syncSuppliersForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting suppliers sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = ApiClient.forAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Use getPaginated to handle pagination
      const suppliers = await client.getPaginated(endpoints.SUPPLIERS);
      logger.debug(`Raw suppliers response:`, suppliers); // Add debug logging
      logger.info(`Found ${suppliers.length} suppliers for agreement ${agreementNumber}`);
      
      for (const supplier of suppliers) {
        const supplierData = this.transformSupplierData(supplier, agreementNumber);
        logger.debug(`Transformed supplier data:`, supplierData); // Add debug logging
        await SupplierModel.upsert(supplierData);
        recordCount++;
      }
      
      // Record successful sync
      await SupplierModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed suppliers sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing suppliers for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await SupplierModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync suppliers across all agreements
  async syncAllSuppliers() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of suppliers across all agreements');
      
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
          const result = await this.syncSuppliersForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing suppliers for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed suppliers sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall suppliers sync process:', error.message);
      throw error;
    }
  }

  // Get suppliers with filtering, sorting, and pagination
  async getSuppliers(agreementNumber, filters = {}, sort = {}, pagination = {}) {
    try {
      return await SupplierModel.find(agreementNumber, filters, sort, pagination);
    } catch (error) {
      logger.error(`Error getting suppliers for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get supplier by number
  async getSupplierByNumber(supplierNumber, agreementNumber) {
    try {
      const supplier = await SupplierModel.findByNumberAndAgreement(supplierNumber, agreementNumber);
      
      if (!supplier) {
        throw ApiError.notFound(`Supplier with number ${supplierNumber} not found for agreement ${agreementNumber}`);
      }
      
      return supplier;
    } catch (error) {
      logger.error(`Error getting supplier ${supplierNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new SupplierService();