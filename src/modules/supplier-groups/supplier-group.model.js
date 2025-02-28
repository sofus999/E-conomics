const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class SupplierGroupModel {
  // Find by supplier group number and agreement number
  static async findByNumberAndAgreement(supplierGroupNumber, agreementNumber) {
    try {
      const groups = await db.query(
        'SELECT * FROM supplier_groups WHERE supplier_group_number = ? AND agreement_number = ?',
        [supplierGroupNumber, agreementNumber]
      );
      
      return groups.length > 0 ? groups[0] : null;
    } catch (error) {
      logger.error(`Error finding supplier group by number ${supplierGroupNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get all supplier groups for an agreement
  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM supplier_groups WHERE agreement_number = ? ORDER BY supplier_group_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting supplier groups for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update supplier group
  static async upsert(groupData) {
    try {
      const safeData = {
        supplier_group_number: groupData.supplier_group_number ?? null,
        agreement_number: groupData.agreement_number ?? null,
        name: groupData.name ?? null,
        account_number: groupData.account_number ?? null,
        suppliers_count: groupData.suppliers_count ?? 0,
        self_url: groupData.self_url ?? null
      };

      await db.query(`
        INSERT INTO supplier_groups (
          supplier_group_number,
          agreement_number,
          name,
          account_number,
          suppliers_count,
          self_url
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          account_number = VALUES(account_number),
          suppliers_count = VALUES(suppliers_count),
          self_url = VALUES(self_url),
          updated_at = CURRENT_TIMESTAMP
      `, [
        safeData.supplier_group_number,
        safeData.agreement_number,
        safeData.name,
        safeData.account_number,
        safeData.suppliers_count,
        safeData.self_url
      ]);

      return safeData;
    } catch (error) {
      logger.error('Error upserting supplier group:', error.message);
      throw error;
    }
  }

  // Record sync log for supplier groups
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
          `supplier_groups_${agreementNumber}`,
          'sync',
          recordCount,
          errorMessage ? 'error' : 'success',
          errorMessage,
          started,
          completed,
          durationMs
        ]
      );
    } catch (error) {
      logger.error('Error recording sync log:', error.message);
    }
  }
}

module.exports = SupplierGroupModel;