const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class InvoiceModel {
  // Create a new invoice in the database
  static async create(invoiceData) {
    try {
      // Generate a unique ID for the invoice
      const invoiceId = invoiceData.id || `${invoiceData.invoice_type}-${invoiceData.draft_invoice_number || invoiceData.invoice_number}`;
      
      // Insert invoice record
      const result = await db.query(
        `INSERT INTO invoices (
          id, invoice_number, draft_invoice_number, customer_number, 
          currency, exchange_rate, date, due_date, 
          net_amount, gross_amount, vat_amount, 
          invoice_type, payment_status, customer_name, 
          reference_number, notes, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          invoiceData.invoice_number || null,
          invoiceData.draft_invoice_number || null,
          invoiceData.customer_number,
          invoiceData.currency,
          invoiceData.exchange_rate || null,
          invoiceData.date,
          invoiceData.due_date || null,
          invoiceData.net_amount || 0,
          invoiceData.gross_amount || 0,
          invoiceData.vat_amount || 0,
          invoiceData.invoice_type,
          invoiceData.payment_status || 'pending',
          invoiceData.customer_name,
          invoiceData.reference_number || null,
          invoiceData.notes || null,
          JSON.stringify(invoiceData.data || {})
        ]
      );
      
      return { id: invoiceId, ...invoiceData };
    } catch (error) {
      logger.error('Error creating invoice:', error.message);
      throw error;
    }
  }
  
  // Update existing invoice
  static async update(id, invoiceData) {
    try {
      await db.query(
        `UPDATE invoices SET
          invoice_number = ?,
          draft_invoice_number = ?,
          customer_number = ?,
          currency = ?,
          exchange_rate = ?,
          date = ?,
          due_date = ?,
          net_amount = ?,
          gross_amount = ?,
          vat_amount = ?,
          invoice_type = ?,
          payment_status = ?,
          customer_name = ?,
          reference_number = ?,
          notes = ?,
          data = ?
        WHERE id = ?`,
        [
          invoiceData.invoice_number || null,
          invoiceData.draft_invoice_number || null,
          invoiceData.customer_number,
          invoiceData.currency,
          invoiceData.exchange_rate || null,
          invoiceData.date,
          invoiceData.due_date || null,
          invoiceData.net_amount || 0,
          invoiceData.gross_amount || 0,
          invoiceData.vat_amount || 0,
          invoiceData.invoice_type,
          invoiceData.payment_status || 'pending',
          invoiceData.customer_name,
          invoiceData.reference_number || null,
          invoiceData.notes || null,
          JSON.stringify(invoiceData.data || {}),
          id
        ]
      );
      
      return { id, ...invoiceData };
    } catch (error) {
      logger.error(`Error updating invoice ${id}:`, error.message);
      throw error;
    }
  }
  
  // Create or update invoice (upsert)
  static async upsert(invoiceData) {
    const invoiceId = invoiceData.id || 
      `${invoiceData.invoice_type}-${invoiceData.draft_invoice_number || invoiceData.invoice_number}`;
    
    try {
      // Check if invoice exists
      const existing = await this.findById(invoiceId);
      
      if (existing) {
        return await this.update(invoiceId, { ...invoiceData, id: invoiceId });
      } else {
        return await this.create({ ...invoiceData, id: invoiceId });
      }
    } catch (error) {
      logger.error(`Error upserting invoice ${invoiceId}:`, error.message);
      throw error;
    }
  }
  
  // Find invoice by ID
  static async findById(id) {
    try {
      const invoice = await db.query(
        'SELECT * FROM invoices WHERE id = ?',
        [id]
      );
      
      return invoice[0] || null;
    } catch (error) {
      logger.error(`Error finding invoice ${id}:`, error.message);
      throw error;
    }
  }
  
  // Find invoices with filtering, sorting, and pagination
  static async find(filters = {}, sort = { field: 'date', order: 'DESC' }, pagination = { page: 1, limit: 50 }) {
    try {
      // Build WHERE clause
      let whereClause = '';
      const whereParams = [];
      
      if (Object.keys(filters).length > 0) {
        const conditions = [];
        
        if (filters.customer_number) {
          conditions.push('customer_number = ?');
          whereParams.push(filters.customer_number);
        }
        
        if (filters.invoice_type) {
          conditions.push('invoice_type = ?');
          whereParams.push(filters.invoice_type);
        }
        
        if (filters.payment_status) {
          conditions.push('payment_status = ?');
          whereParams.push(filters.payment_status);
        }
        
        if (filters.date_from) {
          conditions.push('date >= ?');
          whereParams.push(filters.date_from);
        }
        
        if (filters.date_to) {
          conditions.push('date <= ?');
          whereParams.push(filters.date_to);
        }
        
        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }
      }
      
      // Build ORDER BY clause
      const sortField = sort.field || 'date';
      const sortOrder = sort.order === 'ASC' ? 'ASC' : 'DESC';
      const orderClause = `ORDER BY ${sortField} ${sortOrder}`;
      
      // Build LIMIT clause for pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 50;
      const offset = (page - 1) * limit;
      const limitClause = `LIMIT ${limit} OFFSET ${offset}`;
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM invoices ${whereClause}`;
      const countResult = await db.query(countQuery, whereParams);
      const total = countResult[0].total || 0;
      
      // Get paginated results
      const query = `
        SELECT * FROM invoices 
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
      logger.error('Error finding invoices:', error.message);
      throw error;
    }
  }
  
  // Save invoice lines for an invoice
  static async saveInvoiceLines(invoiceId, lines) {
    try {
      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return [];
      }
      
      // Use a transaction to ensure all lines are saved consistently
      await db.transaction(async (connection) => {
        // Delete existing lines for this invoice
        await connection.query(
          'DELETE FROM invoice_lines WHERE invoice_id = ?',
          [invoiceId]
        );
        
        // Insert new lines
        for (const line of lines) {
          const lineId = `${invoiceId}-line-${line.line_number}`;
          
          await connection.query(
            `INSERT INTO invoice_lines (
              id, invoice_id, line_number, product_number, 
              description, quantity, unit_price, discount_percentage, 
              unit, total_net_amount, data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              lineId,
              invoiceId,
              line.line_number,
              line.product_number || null,
              line.description,
              line.quantity || 1,
              line.unit_price || 0,
              line.discount_percentage || 0,
              line.unit || null,
              line.total_net_amount || 0,
              JSON.stringify(line.data || {})
            ]
          );
        }
      });
      
      return lines;
    } catch (error) {
      logger.error(`Error saving invoice lines for invoice ${invoiceId}:`, error.message);
      throw error;
    }
  }
  
  // Get invoice lines for an invoice
  static async getInvoiceLines(invoiceId) {
    try {
      const lines = await db.query(
        'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY line_number',
        [invoiceId]
      );
      
      return lines;
    } catch (error) {
      logger.error(`Error getting invoice lines for invoice ${invoiceId}:`, error.message);
      throw error;
    }
  }
  
  // Record sync log
  static async recordSyncLog(entityType, operation, status, recordCount = 0, errorMessage = null, startTime = null) {
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
          entityType,
          operation,
          recordCount,
          status,
          errorMessage,
          started,
          completed,
          durationMs
        ]
      );
      
      return {
        entity: entityType,
        operation,
        status,
        recordCount,
        durationMs
      };
    } catch (error) {
      logger.error('Error recording sync log:', error.message);
      // Don't throw error for logging failures
      return null;
    }
  }
}

module.exports = InvoiceModel;