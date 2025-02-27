const ApiClient = require('../../api/client');
const endpoints = require('../../api/endpoints');
const PaymentTermsModel = require('./payment-terms.model');
const AgreementModel = require('../agreements/agreement.model');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class PaymentTermsService {
  // Get client for a specific agreement
  getClientForAgreement(agreementToken) {
    return ApiClient.forAgreement(agreementToken);
  }

  // Transform API payment terms data to our database model
  transformPaymentTermsData(terms, agreementNumber) {
    return {
      payment_terms_number: terms.paymentTermsNumber,
      name: terms.name,
      days_of_credit: terms.daysOfCredit,
      payment_terms_type: terms.paymentTermsType,
      description: terms.description || null,
      agreement_number: agreementNumber,
      self_url: terms.self
    };
  }

  // Sync payment terms for a specific agreement
  async syncPaymentTermsForAgreement(agreement) {
    const startTime = new Date();
    let recordCount = 0;
    
    try {
      logger.info(`Starting payment terms sync for agreement ${agreement.name} (${agreement.agreement_number})`);
      
      // Create client for this agreement
      const client = this.getClientForAgreement(agreement.agreement_grant_token);
      
      // Get the agreement number directly from the API to confirm
      const agreementInfo = await client.getAgreementInfo();
      const agreementNumber = agreementInfo.agreementNumber;
      
      // Fetch payment terms
      const paymentTerms = await client.getPaginated(endpoints.PAYMENT_TERMS);
      logger.info(`Found ${paymentTerms.length} payment terms for agreement ${agreementNumber}`);
      
      // Process each payment term
      for (const terms of paymentTerms) {
        // Transform API data to our model
        const termsData = this.transformPaymentTermsData(terms, agreementNumber);
        
        // Upsert the payment terms
        await PaymentTermsModel.upsert(termsData);
        
        recordCount++;
      }
      
      // Record successful sync
      await PaymentTermsModel.recordSyncLog(
        agreementNumber,
        recordCount,
        null,
        startTime
      );
      
      logger.info(`Completed payment terms sync for agreement ${agreementNumber}: ${recordCount} records processed`);
      
      return {
        agreement: {
          id: agreement.id,
          name: agreement.name,
          agreement_number: agreementNumber
        },
        recordCount
      };
      
    } catch (error) {
      logger.error(`Error syncing payment terms for agreement ${agreement.id}:`, error.message);
      
      // Record failed sync
      await PaymentTermsModel.recordSyncLog(
        agreement.agreement_number || 'unknown',
        recordCount,
        error.message,
        startTime
      );
      
      throw error;
    }
  }

  // Sync payment terms across all agreements
  async syncAllPaymentTerms() {
    const startTime = new Date();
    const agreementResults = [];
    let totalCount = 0;
    
    try {
      logger.info('Starting sync of payment terms across all agreements');
      
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
          const result = await this.syncPaymentTermsForAgreement(agreement);
          agreementResults.push(result);
          totalCount += result.recordCount;
        } catch (error) {
          logger.error(`Error syncing payment terms for agreement ${agreement.name}:`, error.message);
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
      
      logger.info(`Completed payment terms sync across all agreements: ${totalCount} records processed`);
      
      return {
        status: 'success',
        results: agreementResults,
        totalCount
      };
      
    } catch (error) {
      logger.error('Error in overall payment terms sync process:', error.message);
      throw error;
    }
  }

  // Get payment terms by agreement
  async getPaymentTermsByAgreement(agreementNumber) {
    try {
      return await PaymentTermsModel.getByAgreement(agreementNumber);
    } catch (error) {
      logger.error(`Error getting payment terms for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get payment term by number
  async getPaymentTermByNumber(paymentTermsNumber, agreementNumber) {
    try {
      const term = await PaymentTermsModel.findByNumberAndAgreement(paymentTermsNumber, agreementNumber);
      
      if (!term) {
        throw ApiError.notFound(`Payment term with number ${paymentTermsNumber} not found for agreement ${agreementNumber}`);
      }
      
      return term;
    } catch (error) {
      logger.error(`Error getting payment term ${paymentTermsNumber} for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = new PaymentTermsService();