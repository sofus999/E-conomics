const db = require('../../db');
const logger = require('../core/logger');

class AccountingPeriodModel {
  /**
   * Find accounting period by period number, year, and agreement number
   */
  static async findByNumberYearAndAgreement(periodNumber, year, agreementNumber) {
    try {
      const periods = await db.query(
        'SELECT * FROM accounting_periods WHERE period_number = ? AND year = ? AND agreement_number = ?',
        [periodNumber, year, agreementNumber]
      );
      
      return periods.length > 0 ? periods[0] : null;
    } catch (error) {
      logger.error(`Error finding accounting period by number ${periodNumber}, year ${year} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Create or update an accounting period
   */
  static async upsert(periodData) {
    try {
      const existing = await this.findByNumberYearAndAgreement(
        periodData.period_number,
        periodData.year,
        periodData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE accounting_periods SET
            from_date = ?,
            to_date = ?,
            barred = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE period_number = ? AND year = ? AND agreement_number = ?`,
          [
            periodData.from_date,
            periodData.to_date,
            periodData.barred || false,
            periodData.self_url,
            periodData.period_number,
            periodData.year,
            periodData.agreement_number
          ]
        );
        
        return { ...existing, ...periodData };
      } else {
        await db.query(
          `INSERT INTO accounting_periods (
            period_number,
            year,
            agreement_number,
            from_date,
            to_date,
            barred,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            periodData.period_number,
            periodData.year,
            periodData.agreement_number,
            periodData.from_date,
            periodData.to_date,
            periodData.barred || false,
            periodData.self_url
          ]
        );
        
        return periodData;
      }
    } catch (error) {
      logger.error('Error upserting accounting period:', error.message);
      throw error;
    }
  }

  /**
   * Record sync log for accounting periods
   */
  static async recordSyncLog(agreementNumber, year, recordCount = 0, errorMessage = null, startTime = null) {
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
          `accounting_periods_${year}_${agreementNumber}`,
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
        entity: `accounting_periods_${year}_${agreementNumber}`,
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

module.exports = AccountingPeriodModel;