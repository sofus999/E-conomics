const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class ProductModel {
  // Find by product number and agreement number
  static async findByNumberAndAgreement(productNumber, agreementNumber) {
    try {
      const products = await db.query(
        'SELECT * FROM products WHERE product_number = ? AND agreement_number = ?',
        [productNumber, agreementNumber]
      );
      
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      logger.error(`Error finding product by number ${productNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Get all products for an agreement with filtering, sorting, and pagination
  static async find(agreementNumber, filters = {}, sort = { field: 'name', order: 'ASC' }, pagination = { page: 1, limit: 50 }) {
    try {
      // Build WHERE clause
      let whereClause = 'WHERE agreement_number = ?';
      const whereParams = [agreementNumber];
      
      if (filters.product_group_number) {
        whereClause += ' AND product_group_number = ?';
        whereParams.push(filters.product_group_number);
      }
      
      if (filters.barred !== undefined) {
        whereClause += ' AND barred = ?';
        whereParams.push(filters.barred);
      }
      
      if (filters.name) {
        whereClause += ' AND name LIKE ?';
        whereParams.push(`%${filters.name}%`);
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
      const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
      const countResult = await db.query(countQuery, whereParams);
      const total = countResult[0].total || 0;
      
      // Get paginated results
      const query = `
        SELECT * FROM products 
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
      logger.error(`Error finding products for agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Create or update product
  static async upsert(productData) {
    try {
      // Ensure all values are defined or null
      const safeData = {
        product_number: productData.product_number ?? null,
        agreement_number: productData.agreement_number ?? null,
        name: productData.name ?? null,
        product_group_number: productData.product_group_number ?? null,
        description: productData.description ?? null,
        unit: productData.unit ?? null,
        price: productData.price ?? null,
        cost_price: productData.cost_price ?? null,
        recommended_price: productData.recommended_price ?? null,
        is_accessible: productData.is_accessible ?? true,
        inventory: productData.inventory ?? 0,
        barred: productData.barred ?? false,
        last_updated: productData.last_updated ? new Date(productData.last_updated) : new Date(),
        self_url: productData.self_url ?? null
      };

      const existing = await this.findByNumberAndAgreement(
        safeData.product_number, 
        safeData.agreement_number
      );
      
      if (existing) {
        // Update existing product
        await db.query(
          `UPDATE products SET
            name = ?,
            product_group_number = ?,
            description = ?,
            unit = ?,
            price = ?,
            cost_price = ?,
            recommended_price = ?,
            is_accessible = ?,
            inventory = ?,
            barred = ?,
            last_updated = ?,
            self_url = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE product_number = ? AND agreement_number = ?`,
          [
            safeData.name,
            safeData.product_group_number,
            safeData.description,
            safeData.unit,
            safeData.price,
            safeData.cost_price,
            safeData.recommended_price,
            safeData.is_accessible,
            safeData.inventory,
            safeData.barred,
            safeData.last_updated,
            safeData.self_url,
            safeData.product_number,
            safeData.agreement_number
          ]
        );
        
        return { ...existing, ...safeData };
      } else {
        // Create new product
        await db.query(
          `INSERT INTO products (
            product_number,
            name,
            agreement_number,
            product_group_number,
            description,
            unit,
            price,
            cost_price,
            recommended_price,
            is_accessible,
            inventory,
            barred,
            last_updated,
            self_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            safeData.product_number,
            safeData.name,
            safeData.agreement_number,
            safeData.product_group_number,
            safeData.description,
            safeData.unit,
            safeData.price,
            safeData.cost_price,
            safeData.recommended_price,
            safeData.is_accessible,
            safeData.inventory,
            safeData.barred,
            safeData.last_updated,
            safeData.self_url
          ]
        );
        
        return safeData;
      }
    } catch (error) {
      logger.error('Error upserting product:', error.message);
      throw error;
    }
  }

  // Record sync log for products
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
          `products_${agreementNumber}`,
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
        entity: `products_${agreementNumber}`,
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

  // Smart upsert method
  static async smartUpsert(product) {
    const safeProduct = {
      product_number: product.productNumber ?? null,
      agreement_number: product.agreement_number ?? null, // Passed externally if not in API response
      name: product.name ?? null,
      product_group_number: product.productGroup ? product.productGroup.productGroupNumber : null,
      description: product.description ?? null, // API does not provide description so remains null
      unit: product.unit ?? null,              // API does not provide unit so remains null
      price: product.salesPrice ?? null,         // Use salesPrice as price
      cost_price: null,                          // Not provided in API
      recommended_price: product.recommendedPrice ?? null,
      is_accessible: product.is_accessible !== undefined ? product.is_accessible : true,
      inventory: product.minimumStock !== undefined ? product.minimumStock : 0,
      barred: product.barred !== undefined ? product.barred : false,
      last_updated: product.lastUpdated ? new Date(product.lastUpdated) : new Date(),
      self_url: product.self ?? null
    };

    const existing = await this.findByNumberAndAgreement(safeProduct.product_number, safeProduct.agreement_number);
    if (existing) {
      await db.query(
        `UPDATE products SET
          name = ?,
          product_group_number = ?,
          description = ?,
          unit = ?,
          price = ?,
          cost_price = ?,
          recommended_price = ?,
          is_accessible = ?,
          inventory = ?,
          barred = ?,
          last_updated = ?,
          self_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_number = ? AND agreement_number = ?`,
        [
          safeProduct.name,
          safeProduct.product_group_number,
          safeProduct.description,
          safeProduct.unit,
          safeProduct.price,
          safeProduct.cost_price,
          safeProduct.recommended_price,
          safeProduct.is_accessible,
          safeProduct.inventory,
          safeProduct.barred,
          safeProduct.last_updated,
          safeProduct.self_url,
          safeProduct.product_number,
          safeProduct.agreement_number
        ]
      );
      return { ...existing, ...safeProduct };
    } else {
      await db.query(
        `INSERT INTO products (
            product_number,
            name,
            agreement_number,
            product_group_number,
            description,
            unit,
            price,
            cost_price,
            recommended_price,
            is_accessible,
            inventory,
            barred,
            last_updated,
            self_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeProduct.product_number,
          safeProduct.name,
          safeProduct.agreement_number,
          safeProduct.product_group_number,
          safeProduct.description,
          safeProduct.unit,
          safeProduct.price,
          safeProduct.cost_price,
          safeProduct.recommended_price,
          safeProduct.is_accessible,
          safeProduct.inventory,
          safeProduct.barred,
          safeProduct.last_updated,
          safeProduct.self_url
        ]
      );
      return safeProduct;
    }
  }
}

module.exports = ProductModel;