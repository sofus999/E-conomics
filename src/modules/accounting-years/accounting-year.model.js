// src/modules/accounting-years/accounting-year.model.js
const db = require('../../db');
const logger = require('../core/logger');

class AccountingYearModel {
  /**
   * Find accounting year by year identifier and agreement number
   */
  static async findByYearAndAgreement(yearId, agreementNumber) {
    try {
      const years = await db.query(
        'SELECT * FROM accounting_years WHERE year_id = ? AND agreement_number = ?',
        [yearId, agreementNumber]
      );
      
      return years.length > 0 ? years[0] : null;
    } catch (error) {
      logger.error(`Error finding accounting year by year ${yearId} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Create or update an accounting year
   */
  static async upsert(yearData) {
    try {
      const existing = await this.findByYearAndAgreement(
        yearData.year_id, 
        yearData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE accounting_years SET
            start_date = ?,
            end_date = ?,
            closed = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE year_id = ? AND agreement_number = ?`,
          [
            yearData.start_date,
            yearData.end_date,
            yearData.closed || false,
            yearData.self_url,
            yearData.year_id,
            yearData.agreement_number
          ]
        );
        
        return { ...existing, ...yearData };
      } else {
        await db.query(
          `INSERT INTO accounting_years (
            year_id,
            agreement_number,
            start_date,
            end_date,
            closed,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            yearData.year_id,
            yearData.agreement_number,
            yearData.start_date,
            yearData.end_date,
            yearData.closed || false,
            yearData.self_url
          ]
        );
        
        return yearData;
      }
    } catch (error) {
      logger.error('Error upserting accounting year:', error.message);
      throw error;
    }
  }

  /**
   * Record sync log for accounting years
   */
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
          `accounting_years_${agreementNumber}`,
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
        entity: `accounting_years_${agreementNumber}`,
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

module.exports = AccountingYearModel;