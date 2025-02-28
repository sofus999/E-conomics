const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AccountModel {
  static async findByNumberAndAgreement(accountNumber, agreementNumber) {
    try {
      const accounts = await db.query(
        'SELECT * FROM accounts WHERE account_number = ? AND agreement_number = ?',
        [accountNumber, agreementNumber]
      );
      
      return accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      logger.error(`Error finding account by number ${accountNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM accounts WHERE agreement_number = ? ORDER BY account_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting accounts for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async upsert(accountData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        accountData.account_number, 
        accountData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE accounts SET
            account_type = ?,
            name = ?,
            balance = ?,
            debit_credit = ?,
            block_direct_entries = ?,
            vat_code = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE account_number = ? AND agreement_number = ?`,
          [
            accountData.account_type,
            accountData.name,
            accountData.balance,
            accountData.debit_credit,
            accountData.block_direct_entries,
            accountData.vat_code,
            accountData.self_url,
            accountData.account_number,
            accountData.agreement_number
          ]
        );
        
        return { ...existing, ...accountData };
      } else {
        await db.query(
          `INSERT INTO accounts (
            account_number,
            agreement_number,
            account_type,
            name,
            balance,
            debit_credit,
            block_direct_entries,
            vat_code,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accountData.account_number,
            accountData.agreement_number,
            accountData.account_type,
            accountData.name,
            accountData.balance,
            accountData.debit_credit,
            accountData.block_direct_entries,
            accountData.vat_code,
            accountData.self_url
          ]
        );
        
        return accountData;
      }
    } catch (error) {
      logger.error('Error upserting account:', error.message);
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
          `accounts_${agreementNumber}`,
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
        entity: `accounts_${agreementNumber}`,
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

module.exports = AccountModel;