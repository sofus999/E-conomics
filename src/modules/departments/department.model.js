const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class DepartmentModel {
  static async findByNumberAndAgreement(departmentNumber, agreementNumber) {
    try {
      const departments = await db.query(
        'SELECT * FROM departments WHERE department_number = ? AND agreement_number = ?',
        [departmentNumber, agreementNumber]
      );
      
      return departments.length > 0 ? departments[0] : null;
    } catch (error) {
      logger.error(`Error finding department by number ${departmentNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM departments WHERE agreement_number = ? ORDER BY department_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting departments for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  static async upsert(departmentData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        departmentData.department_number, 
        departmentData.agreement_number
      );
      
      if (existing) {
        await db.query(
          `UPDATE departments SET
            name = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE department_number = ? AND agreement_number = ?`,
          [
            departmentData.name,
            departmentData.self_url,
            departmentData.department_number,
            departmentData.agreement_number
          ]
        );
        
        return { ...existing, ...departmentData };
      } else {
        await db.query(
          `INSERT INTO departments (
            department_number,
            agreement_number,
            name,
            self_url
          ) VALUES (?, ?, ?, ?)`,
          [
            departmentData.department_number,
            departmentData.agreement_number,
            departmentData.name,
            departmentData.self_url
          ]
        );
        
        return departmentData;
      }
    } catch (error) {
      logger.error('Error upserting department:', error.message);
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
          `departments_${agreementNumber}`,
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
        entity: `departments_${agreementNumber}`,
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

module.exports = DepartmentModel;