const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const CustomerModel = require('./customer.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class CustomerService {
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  transformCustomerData(customer, agreementNumber) {
    return {
      customer_number: customer.customerNumber,
      agreement_number: agreementNumber,
      name: customer.name,
      currency: customer.currency,
      payment_terms_number: customer.paymentTerms?.paymentTermsNumber || null,
      customer_group_number: customer.customerGroup?.customerGroupNumber || null,
      address: customer.address || null,
      balance: customer.balance || 0.00,
      due_amount: customer.dueAmount || 0.00,
      corporate_identification_number: customer.corporateIdentificationNumber || null,
      city: customer.city || null,
      country: customer.country || null,
      email: customer.email || null,
      zip: customer.zip || null,
      telephone_and_fax_number: customer.telephoneAndFaxNumber || null,
      vat_zone_number: customer.vatZone?.vatZoneNumber || null,
      last_updated: customer.lastUpdated ? new Date(customer.lastUpdated) : null,
      self_url: customer.self
    };
  }

  async syncCustomersForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting customers sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      const customers = await client.getPaginated(endpoints.CUSTOMERS);
      logger.info(`Found ${customers.length} customers for agreement ${agreementNumber}`);
      
      for (const customer of customers) {
        const customerData = this.transformCustomerData(customer, agreementNumber);
        await CustomerModel.upsert(customerData);
        recordCount++;
      }
      
      await CustomerModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed customers sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing customers for agreement ${agreement.id}:`, error.message);
      
      await CustomerModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  async syncAllCustomers() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of customers across all agreements');
      
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
      
      for (const agreement of agreements) {
        try {
          const result = await this.syncCustomersForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing customers for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed customers sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall customers sync process:', error.message);
      throw error;
    }
  }

  async getCustomersByAgreement(agreementNumber) {
    try {
      return await CustomerModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting customers for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  async getCustomerByNumber(customerNumber, agreementNumber) {
    try {
      const customer = await CustomerModel.findByNumberAndAgreement(customerNumber, agreementNumber);
      
      if (!customer) {
        throw ApiError.notFound(`Customer with number ${customerNumber} not found for agreement ${agreementNumber}`);
      }
      
      return customer;
    } catch (error) {
      logger.error(`Error getting customer ${customerNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new CustomerService();