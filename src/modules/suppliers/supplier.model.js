const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class SupplierModel {
  // Find by supplier number and agreement number
  static async findByNumberAndAgreement(supplierNumber, agreementNumber) {
    try {
      const suppliers = await db.query(
        'SELECT * FROM suppliers WHERE supplier_number = ? AND agreement_number = ?',
        [supplierNumber, agreementNumber]
      );
      
      return suppliers.length > 0 ? suppliers[0] : null;
    } catch (error) {
      logger.error(`Error finding supplier by number ${supplierNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get suppliers with filtering, sorting, and pagination
  static async find(agreementNumber, filters = {}, sort = { field: 'name', order: 'ASC' }, pagination = { page: 1, limit: 50 }) {
    try {
      // Build WHERE clause
      let whereClause = 'WHERE agreement_number = ?';
      const whereParams = [agreementNumber];
      
      if (filters.supplier_group_number) {
        whereClause += ' AND supplier_group_number = ?';
        whereParams.push(filters.supplier_group_number);
      }
      
      if (filters.barred !== undefined) {
        whereClause += ' AND barred = ?';
        whereParams.push(filters.barred);
      }
      
      if (filters.name) {
        whereClause += ' AND name LIKE ?';
        whereParams.push(`%${filters.name}%`);
      }
      
      if (filters.city) {
        whereClause += ' AND city LIKE ?';
        whereParams.push(`%${filters.city}%`);
      }
      
      if (filters.country) {
        whereClause += ' AND country LIKE ?';
        whereParams.push(`%${filters.country}%`);
      }
      
      // Build ORDER BY clause
      const sortField = sort.field || 'name';
      const sortOrder = sort.order === 'ASC' ? 'ASC' : 'DESC';
      const orderClause = `ORDER BY ${sortField} ${sortOrder}`;
      
      // Build LIMIT clause for pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 50;
      const offset = (page - 1) * limit;
      const limitClause = `LIMIT ${limit} OFFSET ${offset}`;
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM suppliers ${whereClause}`;
      const countResult = await db.query(countQuery, whereParams);
      const total = countResult[0].total || 0;
      
      // Get paginated results
      const query = `
        SELECT * FROM suppliers 
        ${whereClause} 
        ${orderClause} 
        ${limitClause}
      `;
      
      const results = await db.query(query, whereParams);
      
      return {
        data: results,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error finding suppliers for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update supplier
  static async upsert(supplierData) {
    try {
      const safeData = {
        supplier_number: supplierData.supplier_number,
        agreement_number: supplierData.agreement_number,
        name: supplierData.name,
        supplier_group_number: supplierData.supplier_group_number,
        address: supplierData.address,
        zip: supplierData.zip,
        city: supplierData.city,
        country: supplierData.country,
        email: supplierData.email,
        phone: supplierData.phone,
        currency: supplierData.currency,
        payment_terms_number: supplierData.payment_terms_number,
        vat_number: supplierData.vat_number,
        corp_identification_number: supplierData.corp_identification_number,
        default_delivery_location: supplierData.default_delivery_location,
        barred: supplierData.barred,
        creditor_id: supplierData.creditor_id,
        payment_type_number: supplierData.payment_type_number,
        cost_account_number: supplierData.cost_account_number,
        self_url: supplierData.self_url
      };

      const existing = await this.findByNumberAndAgreement(
        safeData.supplier_number,
        safeData.agreement_number
      );

      if (existing) {
        await db.query(`
          UPDATE suppliers 
          SET name = ?,
              supplier_group_number = ?,
              address = ?,
              zip = ?,
              city = ?,
              country = ?,
              email = ?,
              phone = ?,
              currency = ?,
              payment_terms_number = ?,
              vat_number = ?,
              corp_identification_number = ?,
              default_delivery_location = ?,
              barred = ?,
              creditor_id = ?,
              payment_type_number = ?,
              cost_account_number = ?,
              self_url = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE supplier_number = ? AND agreement_number = ?`,
          [
            safeData.name,
            safeData.supplier_group_number,
            safeData.address,
            safeData.zip,
            safeData.city,
            safeData.country,
            safeData.email,
            safeData.phone,
            safeData.currency,
            safeData.payment_terms_number,
            safeData.vat_number,
            safeData.corp_identification_number,
            safeData.default_delivery_location,
            safeData.barred,
            safeData.creditor_id,
            safeData.payment_type_number,
            safeData.cost_account_number,
            safeData.self_url,
            safeData.supplier_number,
            safeData.agreement_number
          ]
        );

        return { ...existing, ...safeData };
      } else {
        // For insert, construct the query explicitly
        await db.query(`
          INSERT INTO suppliers (
            supplier_number,
            agreement_number,
            name,
            supplier_group_number,
            address,
            zip,
            city,
            country,
            email,
            phone,
            currency,
            payment_terms_number,
            vat_number,
            corp_identification_number,
            default_delivery_location,
            barred,
            creditor_id,
            payment_type_number,
            cost_account_number,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            safeData.supplier_number,
            safeData.agreement_number,
            safeData.name,
            safeData.supplier_group_number,
            safeData.address,
            safeData.zip,
            safeData.city,
            safeData.country,
            safeData.email,
            safeData.phone,
            safeData.currency,
            safeData.payment_terms_number,
            safeData.vat_number,
            safeData.corp_identification_number,
            safeData.default_delivery_location,
            safeData.barred,
            safeData.creditor_id,
            safeData.payment_type_number,
            safeData.cost_account_number,
            safeData.self_url
          ]
        );

        return safeData;
      }
    } catch (error) {
      logger.error('Error upserting supplier:', error.message);
      throw error;
    }
  }

  // Record sync log for suppliers
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
          `suppliers_${agreementNumber}`,
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

module.exports = SupplierModel;