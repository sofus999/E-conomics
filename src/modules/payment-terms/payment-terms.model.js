const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class PaymentTermsModel {
  // Find by payment terms number and agreement number
  static async findByNumberAndAgreement(paymentTermsNumber, agreementNumber) {
    try {
      const terms = await db.query(
        'SELECT * FROM payment_terms WHERE payment_terms_number = ? AND agreement_number = ?',
        [paymentTermsNumber, agreementNumber]
      );
      
      return terms.length > 0 ? terms[0] : null;
    } catch (error) {
      logger.error(`Error finding payment terms by number ${paymentTermsNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get all payment terms for an agreement
  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM payment_terms WHERE agreement_number = ? ORDER BY payment_terms_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting payment terms for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update payment terms
  static async upsert(termsData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        termsData.payment_terms_number, 
        termsData.agreement_number
      );
      
      if (existing) {
        // Update existing payment terms
        await db.query(
          `UPDATE payment_terms SET
            name = ?,
            days_of_credit = ?,
            payment_terms_type = ?,
            description = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE payment_terms_number = ? AND agreement_number = ?`,
          [
            termsData.name,
            termsData.days_of_credit,
            termsData.payment_terms_type,
            termsData.description,
            termsData.self_url,
            termsData.payment_terms_number,
            termsData.agreement_number
          ]
        );
        
        return { ...existing, ...termsData };
      } else {
        // Create new payment terms
        await db.query(
          `INSERT INTO payment_terms (
            payment_terms_number,
            name,
            days_of_credit,
            payment_terms_type,
            description,
            agreement_number,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            termsData.payment_terms_number,
            termsData.name,
            termsData.days_of_credit,
            termsData.payment_terms_type,
            termsData.description,
            termsData.agreement_number,
            termsData.self_url
          ]
        );
        
        return termsData;
      }
    } catch (error) {
      logger.error('Error upserting payment terms:', error.message);
      throw error;
    }
  }

  // Record sync log for payment terms
  static async recordSyncLog(agreementNumber, recordCount = 0, errorMessage = null, startTime = null) {
    try {
      const started = startTime || new Date();
      const completed = new Date();
      const durationMs = completed.getTime() - started.getTime();
      
      await db.query(
        `INSERT INTO sync_logs (
          entity, operation, record_count, status, 
          error_message, started_at, completed_at, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `payment_terms_${agreementNumber}`,
          'sync',
          recordCount,
          errorMessage ? 'error' : 'success',
          errorMessage,
          started,
          completed,
          durationMs
        ]
      );
      
      return {
        entity: `payment_terms_${agreementNumber}`,
        operation: 'sync',
        status: errorMessage ? 'error' : 'success',
        recordCount,
        durationMs
      };
    } catch (error) {
      logger.error('Error recording sync log:', error.message);
      // Don't throw for logging failures
      return null;
    }
  }
}

module.exports = PaymentTermsModel;
