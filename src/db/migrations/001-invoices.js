const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 001-invoices');
  
  try {
    // Invoices table - common fields for both draft and booked invoices
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        invoice_number INT,
        draft_invoice_number INT,
        customer_number INT,
        agreement_number INT,
        currency VARCHAR(3),
        exchange_rate DECIMAL(10,6),
        date DATE,
        due_date DATE,
        net_amount DECIMAL(15,2),
        gross_amount DECIMAL(15,2),
        vat_amount DECIMAL(15,2),
        invoice_type ENUM('draft', 'booked', 'paid', 'unpaid'),
        payment_status ENUM('pending', 'paid', 'overdue', 'partial'),
        customer_name VARCHAR(255),
        reference_number VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_number (customer_number),
        INDEX idx_agreement_number (agreement_number),
        INDEX idx_date (date),
        INDEX idx_invoice_type (invoice_type),
        INDEX idx_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Invoice lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoice_lines (
        id VARCHAR(50) PRIMARY KEY,
        invoice_id VARCHAR(50),
        line_number INT,
        product_number VARCHAR(50),
        description TEXT,
        quantity DECIMAL(10,2),
        unit_price DECIMAL(15,2),
        discount_percentage DECIMAL(5,2),
        unit VARCHAR(50),
        total_net_amount DECIMAL(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        INDEX idx_invoice_id (invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Sync logs table for tracking synchronization
    await db.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity VARCHAR(50) NOT NULL,
        operation VARCHAR(20) NOT NULL,
        record_count INT,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        duration_ms INT,
        INDEX idx_entity (entity),
        INDEX idx_started_at (started_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 001-invoices completed successfully');
  } catch (error) {
    logger.error('Error running migration 001-invoices:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 001-invoices');
  
  try {
    await db.query('DROP TABLE IF EXISTS invoice_lines');
    await db.query('DROP TABLE IF EXISTS invoices');
    await db.query('DROP TABLE IF EXISTS sync_logs');
    
    logger.info('Migration 001-invoices reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 001-invoices:', error.message);
    throw error;
  }
}

module.exports = { up, down };