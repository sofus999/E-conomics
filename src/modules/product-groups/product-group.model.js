const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class ProductGroupModel {
  // Find by product group number and agreement number
  static async findByNumberAndAgreement(productGroupNumber, agreementNumber) {
    try {
      const groups = await db.query(
        'SELECT * FROM product_groups WHERE product_group_number = ? AND agreement_number = ?',
        [productGroupNumber, agreementNumber]
      );
      
      return groups.length > 0 ? groups[0] : null;
    } catch (error) {
      logger.error(`Error finding product group by number ${productGroupNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get all product groups for an agreement
  static async getByAgreement(agreementNumber) {
    try {
      return await db.query(
        'SELECT * FROM product_groups WHERE agreement_number = ? ORDER BY product_group_number',
        [agreementNumber]
      );
    } catch (error) {
      logger.error(`Error getting product groups for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update product group
  static async upsert(groupData) {
    try {
      const existing = await this.findByNumberAndAgreement(
        groupData.product_group_number, 
        groupData.agreement_number
      );
      
      if (existing) {
        // Update existing product group
        await db.query(
          `UPDATE product_groups SET
            name = ?,
            account_number = ?,
            accrual_account_number = ?,
            products_count = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE product_group_number = ? AND agreement_number = ?`,
          [
            groupData.name,
            groupData.account_number,
            groupData.accrual_account_number,
            groupData.products_count || 0,
            groupData.self_url,
            groupData.product_group_number,
            groupData.agreement_number
          ]
        );
        
        return { ...existing, ...groupData };
      } else {
        // Create new product group
        await db.query(
          `INSERT INTO product_groups (
            product_group_number,
            name,
            agreement_number,
            account_number,
            accrual_account_number,
            products_count,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            groupData.product_group_number,
            groupData.name,
            groupData.agreement_number,
            groupData.account_number,
            groupData.accrual_account_number,
            groupData.products_count || 0,
            groupData.self_url
          ]
        );
        
        return groupData;
      }
    } catch (error) {
      logger.error('Error upserting product group:', error.message);
      throw error;
    }
  }

  // Record sync log for product groups
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
          `product_groups_${agreementNumber}`,
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
        entity: `product_groups_${agreementNumber}`,
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

module.exports = ProductGroupModel;