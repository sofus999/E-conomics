const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class DepartmentalDistributionModel {
  static async findByNumberAndAgreement(distributionNumber, agreementNumber) {
    try {
      const distributions = await db.query(
        'SELECT * FROM departmental_distributions WHERE departmental_distribution_number = ? AND agreement_number = ?',
        [distributionNumber, agreementNumber]
      );
      
      return distributions.length > 0 ? distributions[0] : null;
    } catch (error) {
      logger.error(`Error finding departmental distribution by number ${distributionNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM departmental_distributions WHERE agreement_number = ? ORDER BY departmental_distribution_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting departmental distributions for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async upsert(distributionData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        distributionData.departmental_distribution_number, 
        distributionData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE departmental_distributions SET
            name = ?,
            barred = ?,
            distribution_type = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE departmental_distribution_number = ? AND agreement_number = ?`,
          [
            distributionData.name,
            distributionData.barred,
            distributionData.distribution_type,
            distributionData.self_url,
            distributionData.departmental_distribution_number,
            distributionData.agreement_number
          ]
        );
        
        return { ...existing, ...distributionData };
      } else {
        await db.query(
          `INSERT INTO departmental_distributions (
            departmental_distribution_number,
            agreement_number,
            name,
            barred,
            distribution_type,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            distributionData.departmental_distribution_number,
            distributionData.agreement_number,
            distributionData.name,
            distributionData.barred,
            distributionData.distribution_type,
            distributionData.self_url
          ]
        );
        
        return distributionData;
      }
    } catch (error) {
      logger.error('Error upserting departmental distribution:', error.message);
      throw error;
    }
  }

  static async getDistributionPercentages(distributionNumber, agreementNumber) {
    try {
      return await db.query(
        `SELECT * FROM distribution_percentages 
         WHERE departmental_distribution_number = ? AND agreement_number = ?
         ORDER BY percentage DESC`,
        [distributionNumber, agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting distribution percentages for distribution ${distributionNumber}:`, error.message);
      throw error;
    }
  }

  static async clearDistributionPercentages(distributionNumber, agreementNumber) {
    try {
      await db.query(
        'DELETE FROM distribution_percentages WHERE departmental_distribution_number = ? AND agreement_number = ?',
        [distributionNumber, agreementNumber]
      );
    } catch (error) {
      logger.error(`Error clearing distribution percentages for distribution ${distributionNumber}:`, error.message);
      throw error;
    }
  }

  static async saveDistributionPercentage(data) {
    try {
      await db.query(
        `INSERT INTO distribution_percentages (
          departmental_distribution_number,
          agreement_number,
          department_number,
          percentage
        ) VALUES (?, ?, ?, ?)`,
        [
          data.departmental_distribution_number,
          data.agreement_number,
          data.department_number,
          data.percentage
        ]
      );
    } catch (error) {
      logger.error('Error saving distribution percentage:', error.message);
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
          `departmental_distributions_${agreementNumber}`,
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
        entity: `departmental_distributions_${agreementNumber}`,
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

module.exports = DepartmentalDistributionModel;