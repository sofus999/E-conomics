const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class JournalModel {
  static async findByNumberAndAgreement(journalNumber, agreementNumber) {
    try {
      const journals = await db.query(
        'SELECT * FROM journals WHERE journal_number = ? AND agreement_number = ?',
        [journalNumber, agreementNumber]
      );
      
      return journals.length > 0 ? journals[0] : null;
    } catch (error) {
      logger.error(`Error finding journal by number ${journalNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM journals WHERE agreement_number = ? ORDER BY journal_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting journals for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async upsert(journalData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        journalData.journal_number, 
        journalData.agreement_number
      );
      
      // Ensure settings is never undefined
      const settings = journalData.settings || {};
      
      if (existing) {
        await db.query(
          `UPDATE journals SET
            name = ?,
            min_voucher_number = ?,
            max_voucher_number = ?,
            entry_type_restricted_to = ?,
            settings = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE journal_number = ? AND agreement_number = ?`,
          [
            journalData.name,
            journalData.min_voucher_number,
            journalData.max_voucher_number,
            journalData.entry_type_restricted_to,
            JSON.stringify(settings),  // Ensure it's stringified properly
            journalData.self_url,
            journalData.journal_number,
            journalData.agreement_number
          ]
        );
        
        return { ...existing, ...journalData };
      } else {
        await db.query(
          `INSERT INTO journals (
            journal_number,
            agreement_number,
            name,
            min_voucher_number,
            max_voucher_number,
            entry_type_restricted_to,
            settings,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            journalData.journal_number,
            journalData.agreement_number,
            journalData.name,
            journalData.min_voucher_number,
            journalData.max_voucher_number,
            journalData.entry_type_restricted_to,
            JSON.stringify(settings),  // Ensure it's stringified properly
            journalData.self_url
          ]
        );
        
        return journalData;
      }
    } catch (error) {
      logger.error('Error upserting journal:', error.message);
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
          `journals_${agreementNumber}`,
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
        entity: `journals_${agreementNumber}`,
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

module.exports = JournalModel;