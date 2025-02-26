const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class AgreementModel {
  // Get all agreements
  static async getAll(activeOnly = true) {
    try {
      const query = activeOnly ? 
        'SELECT * FROM agreement_configs WHERE is_active = TRUE ORDER BY name' :
        'SELECT * FROM agreement_configs ORDER BY name';
      
      return await db.query(query);
    } catch (error) {
      logger.error('Error getting agreements:', error.message);
      throw error;
    }
  }
  
  // Get agreement by ID
  static async getById(id) {
    try {
      const agreements = await db.query(
        'SELECT * FROM agreement_configs WHERE id = ?',
        [id]
      );
      
      if (agreements.length === 0) {
        throw ApiError.notFound(`Agreement with ID ${id} not found`);
      }
      
      return agreements[0];
    } catch (error) {
      logger.error(`Error getting agreement ${id}:`, error.message);
      throw error;
    }
  }
  
  // Get agreement by agreement number
  static async getByAgreementNumber(agreementNumber) {
    try {
      const agreements = await db.query(
        'SELECT * FROM agreement_configs WHERE agreement_number = ?',
        [agreementNumber]
      );
      
      return agreements.length > 0 ? agreements[0] : null;
    } catch (error) {
      logger.error(`Error getting agreement by number ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get agreement by token
  static async getByToken(token) {
    try {
      const agreements = await db.query(
        'SELECT * FROM agreement_configs WHERE agreement_grant_token = ?',
        [token]
      );
      
      return agreements.length > 0 ? agreements[0] : null;
    } catch (error) {
      logger.error('Error getting agreement by token:', error.message);
      throw error;
    }
  }
  
  // Create a new agreement (only token required)
  static async create(agreementData) {
    try {
      // Check if agreement with this token already exists
      const existingByToken = await this.getByToken(agreementData.agreement_grant_token);
      if (existingByToken) {
        throw ApiError.badRequest(`Agreement with this token already exists (ID: ${existingByToken.id})`);
      }
      
      // Check if agreement number already exists (if provided)
      if (agreementData.agreement_number) {
        const existingByNumber = await this.getByAgreementNumber(agreementData.agreement_number);
        if (existingByNumber) {
          throw ApiError.badRequest(`Agreement with number ${agreementData.agreement_number} already exists`);
        }
      }
      
      const result = await db.query(
        `INSERT INTO agreement_configs (
          name, agreement_number, agreement_grant_token, is_active
        ) VALUES (?, ?, ?, ?)`,
        [
          agreementData.name || 'Pending API Verification',
          agreementData.agreement_number || null,
          agreementData.agreement_grant_token,
          agreementData.is_active !== undefined ? agreementData.is_active : true
        ]
      );
      
      return {
        id: result.insertId,
        ...agreementData
      };
    } catch (error) {
      logger.error('Error creating agreement:', error.message);
      throw error;
    }
  }
  
  // Update an agreement
  static async update(id, agreementData) {
    try {
      // Check if agreement exists
      await this.getById(id);
      
      // If changing agreement number, check it's not already used
      if (agreementData.agreement_number) {
        const existing = await this.getByAgreementNumber(agreementData.agreement_number);
        if (existing && existing.id !== parseInt(id)) {
          throw ApiError.badRequest(`Agreement with number ${agreementData.agreement_number} already exists`);
        }
      }
      
      await db.query(
        `UPDATE agreement_configs SET
          name = COALESCE(?, name),
          agreement_number = COALESCE(?, agreement_number),
          agreement_grant_token = COALESCE(?, agreement_grant_token),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          agreementData.name || null,
          agreementData.agreement_number || null,
          agreementData.agreement_grant_token || null,
          agreementData.is_active !== undefined ? agreementData.is_active : null,
          id
        ]
      );
      
      return this.getById(id);
    } catch (error) {
      logger.error(`Error updating agreement ${id}:`, error.message);
      throw error;
    }
  }
  
  // Delete an agreement
  static async delete(id) {
    try {
      // Check if agreement exists
      await this.getById(id);
      
      await db.query('DELETE FROM agreement_configs WHERE id = ?', [id]);
      
      return { id };
    } catch (error) {
      logger.error(`Error deleting agreement ${id}:`, error.message);
      throw error;
    }
  }
}

module.exports = AgreementModel;