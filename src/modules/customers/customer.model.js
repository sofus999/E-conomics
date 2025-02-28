const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class CustomerModel {
  static async findByNumberAndAgreement(customerNumber, agreementNumber) {
    try {
      const customers = await db.query(
        'SELECT * FROM customers WHERE customer_number = ? AND agreement_number = ?',
        [customerNumber, agreementNumber]
      );
      
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      logger.error(`Error finding customer by number ${customerNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM customers WHERE agreement_number = ? ORDER BY customer_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting customers for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async upsert(customerData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        customerData.customer_number, 
        customerData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE customers SET
            name = ?,
            currency = ?,
            payment_terms_number = ?,
            customer_group_number = ?,
            address = ?,
            balance = ?,
            due_amount = ?,
            corporate_identification_number = ?,
            city = ?,
            country = ?,
            email = ?,
            zip = ?,
            telephone_and_fax_number = ?,
            vat_zone_number = ?,
            last_updated = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE customer_number = ? AND agreement_number = ?`,
          [
            customerData.name,
            customerData.currency,
            customerData.payment_terms_number,
            customerData.customer_group_number,
            customerData.address,
            customerData.balance,
            customerData.due_amount,
            customerData.corporate_identification_number,
            customerData.city,
            customerData.country,
            customerData.email,
            customerData.zip,
            customerData.telephone_and_fax_number,
            customerData.vat_zone_number,
            customerData.last_updated,
            customerData.self_url,
            customerData.customer_number,
            customerData.agreement_number
          ]
        );
        
        return { ...existing, ...customerData };
      } else {
        await db.query(
          `INSERT INTO customers (
            customer_number,
            agreement_number,
            name,
            currency,
            payment_terms_number,
            customer_group_number,
            address,
            balance,
            due_amount,
            corporate_identification_number,
            city,
            country,
            email,
            zip,
            telephone_and_fax_number,
            vat_zone_number,
            last_updated,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customerData.customer_number,
            customerData.agreement_number,
            customerData.name,
            customerData.currency,
            customerData.payment_terms_number,
            customerData.customer_group_number,
            customerData.address,
            customerData.balance,
            customerData.due_amount,
            customerData.corporate_identification_number,
            customerData.city,
            customerData.country,
            customerData.email,
            customerData.zip,
            customerData.telephone_and_fax_number,
            customerData.vat_zone_number,
            customerData.last_updated,
            customerData.self_url
          ]
        );
        
        return customerData;
      }
    } catch (error) {
      logger.error('Error upserting customer:', error.message);
      throw error;
    }
  }

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
          `customers_${agreementNumber}`,
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
        entity: `customers_${agreementNumber}`,
        operation: 'sync',
        status: errorMessage ? 'error' : 'success',
        recordCount,
        durationMs
      };
    } catch (error) {
      logger.error('Error recording sync log:', error.message);
      return null;
    }
  }
}

module.exports = CustomerModel;