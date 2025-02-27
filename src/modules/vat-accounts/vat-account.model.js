const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class VatAccountModel {
  // Find by VAT code and agreement number
  static async findByCodeAndAgreement(vatCode, agreementNumber) {
    try {
      const accounts = await db.query(
        'SELECT * FROM vat_accounts WHERE vat_code = ? AND agreement_number = ?',
        [vatCode, agreementNumber]
      );
      
      return accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      logger.error(`Error finding VAT account by code ${vatCode} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get all VAT accounts for an agreement
  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM vat_accounts WHERE agreement_number = ? ORDER BY vat_code',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting VAT accounts for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update VAT account
  static async upsert(accountData) {
    try {
      const existing = await this.findByCodeAndAgreement(
        accountData.vat_code, 
        accountData.agreement_number
      );
      
      if (existing) {
        // Update existing VAT account
        await db.query(
          `UPDATE vat_accounts SET
            name = ?,
            vat_percentage = ?,
            account_number = ?,
            contra_account_number = ?,
            vat_type_number = ?,
            vat_type_name = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE vat_code = ? AND agreement_number = ?`,
          [
            accountData.name,
            accountData.vat_percentage,
            accountData.account_number,
            accountData.contra_account_number,
            accountData.vat_type_number,
            accountData.vat_type_name,
            accountData.self_url,
            accountData.vat_code,
            accountData.agreement_number
          ]
        );
        
        return { ...existing, ...accountData };
      } else {
        // Create new VAT account
        await db.query(
          `INSERT INTO vat_accounts (
            vat_code,
            name,
            vat_percentage,
            account_number,
            contra_account_number,
            vat_type_number,
            vat_type_name,
            agreement_number,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accountData.vat_code,
            accountData.name,
            accountData.vat_percentage,
            accountData.account_number,
            accountData.contra_account_number,
            accountData.vat_type_number,
            accountData.vat_type_name,
            accountData.agreement_number,
            accountData.self_url
          ]
        );
        
        return accountData;
      }
    } catch (error) {
      logger.error('Error upserting VAT account:', error.message);
      throw error;
    }
  }

  // Record sync log for VAT accounts
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
          `vat_accounts_${agreementNumber}`,
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
        entity: `vat_accounts_${agreementNumber}`,
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

module.exports = VatAccountModel;