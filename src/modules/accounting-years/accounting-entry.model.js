const db = require('../../db');
const logger = require('../core/logger');

class AccountingEntryModel {
  /**
   * Find accounting entry by entry number, year, and agreement number
   */
  static async findByEntryNumberYearAndAgreement(entryNumber, year, agreementNumber) {
    try {
      const entries = await db.query(
        'SELECT * FROM accounting_entries WHERE entry_number = ? AND year = ? AND agreement_number = ?',
        [entryNumber, year, agreementNumber]
      );
      
      return entries.length > 0 ? entries[0] : null;
    } catch (error) {
      logger.error(`Error finding accounting entry by number ${entryNumber}, year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch insert or update multiple accounting entries
   */
  static async batchUpsert(entries) {
    if (!entries || entries.length === 0) {
      return { inserted: 0, updated: 0 };
    }
    
    try {
      let inserted = 0;
      let updated = 0;
      
      // Process in smaller batches to avoid large transactions
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        await db.transaction(async (connection) => {
          for (const entry of batch) {
            const existing = await this.findByEntryNumberYearAndAgreement(
              entry.entry_number, 
              entry.year, 
              entry.agreement_number
            );
            
            if (existing) {
              await connection.query(
                `UPDATE accounting_entries SET
                  period_number = ?,
                  account_number = ?,
                  amount = ?,
                  amount_in_base_currency = ?,
                  currency = ?,
                  entry_date = ?,
                  entry_text = ?,
                  entry_type = ?,
                  voucher_number = ?,
                  self_url = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE entry_number = ? AND year = ? AND agreement_number = ?`,
                [
                  entry.period_number,
                  entry.account_number,
                  entry.amount,
                  entry.amount_in_base_currency,
                  entry.currency,
                  entry.entry_date,
                  entry.entry_text,
                  entry.entry_type,
                  entry.voucher_number,
                  entry.self_url,
                  entry.entry_number,
                  entry.year,
                  entry.agreement_number
                ]
              );
              updated++;
            } else {
              await connection.query(
                `INSERT INTO accounting_entries (
                  entry_number,
                  year,
                  period_number,
                  agreement_number,
                  account_number,
                  amount,
                  amount_in_base_currency,
                  currency,
                  entry_date,
                  entry_text,
                  entry_type,
                  voucher_number,
                  self_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  entry.entry_number,
                  entry.year,
                  entry.period_number,
                  entry.agreement_number,
                  entry.account_number,
                  entry.amount,
                  entry.amount_in_base_currency,
                  entry.currency,
                  entry.entry_date,
                  entry.entry_text,
                  entry.entry_type,
                  entry.voucher_number,
                  entry.self_url
                ]
              );
              inserted++;
            }
          }
        });
      }
      
      return { inserted, updated };
    } catch (error) {
      logger.error('Error batch upserting accounting entries:', error.message);
      throw error;
    }
  }

  /**
   * Record sync log for accounting entries
   */
  static async recordSyncLog(agreementNumber, year, periodNumber, recordCount = 0, errorMessage = null, startTime = null) {
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
          `accounting_entries_${year}_${periodNumber}_${agreementNumber}`,
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
        entity: `accounting_entries_${year}_${periodNumber}_${agreementNumber}`,
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

module.exports = AccountingEntryModel;