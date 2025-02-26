const db = require('../../db');
const logger = require('../core/logger');
const { ApiError } = require('../core/error.handler');

class InvoiceModel {
  // Find invoice by invoice number and agreement number
  static async findByInvoiceAndAgreementNumber(invoiceNumber, agreementNumber) {
    try {
      const invoices = await db.query(
        'SELECT * FROM invoices WHERE invoice_number = ? AND agreement_number = ?',
        [invoiceNumber, agreementNumber]
      );
      
      return invoices.length > 0 ? invoices[0] : null;
    } catch (error) {
      logger.error(`Error finding invoice by number ${invoiceNumber} and agreement ${agreementNumber}:`, error.message);
      throw error;
    }
  }

  // Find invoice by invoice number (legacy method - kept for backward compatibility)
  static async findByInvoiceNumber(invoiceNumber) {
    try {
      const invoices = await db.query(
        'SELECT * FROM invoices WHERE invoice_number = ?',
        [invoiceNumber]
      );
      
      return invoices.length > 0 ? invoices[0] : null;
    } catch (error) {
      logger.error(`Error finding invoice by number ${invoiceNumber}:`, error.message);
      throw error;
    }
  }

  // Create a new invoice in the database
  static async create(invoiceData) {
    try {
      // Insert invoice record
      const result = await db.query(
        `INSERT INTO invoices (
          invoice_number, draft_invoice_number, customer_number, agreement_number,
          currency, exchange_rate, date, due_date, 
          net_amount, gross_amount, vat_amount, 
          payment_status, customer_name, 
          reference_number, notes, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceData.invoice_number || null,
          invoiceData.draft_invoice_number || null,
          invoiceData.customer_number,
          invoiceData.agreement_number || null,
          invoiceData.currency,
          invoiceData.exchange_rate || null,
          invoiceData.date,
          invoiceData.due_date || null,
          invoiceData.net_amount || 0,
          invoiceData.gross_amount || 0,
          invoiceData.vat_amount || 0,
          invoiceData.payment_status || 'pending',
          invoiceData.customer_name,
          invoiceData.reference_number || null,
          invoiceData.notes || null,
          JSON.stringify(invoiceData.data || {})
        ]
      );
      
      // Get the auto-generated ID
      const newId = result.insertId;
      
      return { id: newId, ...invoiceData };
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
          agreement_number = ?,
          currency = ?,
          exchange_rate = ?,
          date = ?,
          due_date = ?,
          net_amount = ?,
          gross_amount = ?,
          vat_amount = ?,
          payment_status = ?,
          customer_name = ?,
          reference_number = ?,
          notes = ?,
          data = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          invoiceData.invoice_number || null,
          invoiceData.draft_invoice_number || null,
          invoiceData.customer_number,
          invoiceData.agreement_number || null,
          invoiceData.currency,
          invoiceData.exchange_rate || null,
          invoiceData.date,
          invoiceData.due_date || null,
          invoiceData.net_amount || 0,
          invoiceData.gross_amount || 0,
          invoiceData.vat_amount || 0,
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
  
  // Smart upsert - uses invoice_number AND agreement_number to determine if record exists
  static async smartUpsert(invoiceData) {
    try {
      // Get invoice number or draft invoice number
      const invoiceNumber = invoiceData.invoice_number || invoiceData.draft_invoice_number;
      const agreementNumber = invoiceData.agreement_number;
      
      if (!invoiceNumber) {
        throw new Error('Invoice number or draft invoice number is required for upsert');
      }
      
      if (!agreementNumber) {
        throw new Error('Agreement number is required for upsert');
      }
      
      // Check if this specific invoice exists for this agreement
      const existingInvoice = await this.findByInvoiceAndAgreementNumber(invoiceNumber, agreementNumber);
      
      if (existingInvoice) {
        // Determine if new status takes precedence
        const updateStatus = this.shouldUpdateStatus(existingInvoice.payment_status, invoiceData.payment_status);
        
        // If we should update the status, use the new one, otherwise keep the existing one
        const newStatus = updateStatus ? invoiceData.payment_status : existingInvoice.payment_status;
        
        // Create an updated data object that prioritizes new data
        const updatedData = {
          ...existingInvoice,
          ...invoiceData,
          payment_status: newStatus,
          id: existingInvoice.id // Keep the original ID to update the correct record
        };
        
        // Update the existing invoice
        return await this.update(existingInvoice.id, updatedData);
      } else {
        // Create a new invoice
        return await this.create(invoiceData);
      }
    } catch (error) {
      logger.error(`Error upserting invoice:`, error.message);
      throw error;
    }
  }
  
  // Helper method to determine if status should be updated
  static shouldUpdateStatus(currentStatus, newStatus) {
    // Status precedence: overdue > paid > pending
    const statusPriority = {
      'overdue': 3,
      'paid': 2,
      'partial': 1,
      'pending': 0
    };
    
    // Higher number = higher priority
    return (statusPriority[newStatus] || 0) >= (statusPriority[currentStatus] || 0);
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
        
        if (filters.agreement_number) {
          conditions.push('agreement_number = ?');
          whereParams.push(filters.agreement_number);
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
  
  // Find distinct invoice numbers
  static async findDistinctInvoiceNumbers() {
    try {
      const results = await db.query(
        'SELECT DISTINCT invoice_number FROM invoices WHERE invoice_number IS NOT NULL'
      );
      
      return results.map(row => row.invoice_number);
    } catch (error) {
      logger.error('Error finding distinct invoice numbers:', error.message);
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