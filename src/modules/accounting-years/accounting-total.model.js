// src/modules/accounting-years/accounting-total.model.js
const db = require('../../db');
const logger = require('../core/logger');

class AccountingTotalModel {
  /**
   * Find accounting total by account number, year ID, period number, and agreement number
   */
  static async findByKeys(accountNumber, yearId, periodNumber, agreementNumber) {
    try {
      const totals = await db.query(
        'SELECT * FROM accounting_totals WHERE account_number = ? AND year_id = ? AND period_number = ? AND agreement_number = ?',
        [accountNumber, yearId, periodNumber, agreementNumber]
      );
      
      return totals.length > 0 ? totals[0] : null;
    } catch (error) {
      logger.error(`Error finding accounting total for account ${accountNumber}, year ${yearId}, period ${periodNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch insert or update multiple accounting totals
   */
  static async batchUpsert(totals) {
    if (!totals || totals.length === 0) {
      return { inserted: 0, updated: 0 };
    }
    
    try {
      let inserted = 0;
      let updated = 0;
      
      // Process in smaller batches to avoid large transactions
      const batchSize = 100;
      for (let i = 0; i < totals.length; i += batchSize) {
        const batch = totals.slice(i, i + batchSize);
        
        await db.transaction(async (connection) => {
          for (const total of batch) {
            const existing = await this.findByKeys(
              total.account_number, 
              total.year_id, 
              total.period_number, 
              total.agreement_number
            );
            
            if (existing) {
              await connection.query(
                `UPDATE accounting_totals SET
                  total_in_base_currency = ?,
                  from_date = ?,
                  to_date = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE account_number = ? AND year_id = ? AND period_number = ? AND agreement_number = ?`,
                [
                  total.total_in_base_currency,
                  total.from_date,
                  total.to_date,
                  total.account_number,
                  total.year_id,
                  total.period_number,
                  total.agreement_number
                ]
              );
              updated++;
            } else {
              await connection.query(
                `INSERT INTO accounting_totals (
                  account_number,
                  year_id,
                  period_number,
                  agreement_number,
                  total_in_base_currency,
                  from_date,
                  to_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  total.account_number,
                  total.year_id,
                  total.period_number,
                  total.agreement_number,
                  total.total_in_base_currency,
                  total.from_date,
                  total.to_date
                ]
              );
              inserted++;
            }
          }
        });
      }
      
      return { inserted, updated };
    } catch (error) {
      logger.error('Error batch upserting accounting totals:', error.message);
      throw error;
    }
  }

  /**
   * Record sync log for accounting totals
   */
  static async recordSyncLog(agreementNumber, yearId, periodNumber, recordCount = 0, errorMessage = null, startTime = null) {
    try {
      const started = startTime || new Date();
      const completed = new Date();
      const durationMs = completed.getTime() - started.getTime();
      
      const periodText = periodNumber === null ? '0' : periodNumber.toString();
      
      await db.query(
        `INSERT INTO sync_logs (
          entity, operation, record_count, status, 
          error_message, started_at, completed_at, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `accounting_totals_${yearId}_${periodText}_${agreementNumber}`,
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
        entity: `accounting_totals_${yearId}_${periodText}_${agreementNumber}`,
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

module.exports = AccountingTotalModel;