const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 008-suppliers');
  
  try {
    // Disable foreign key checks temporarily
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop existing table first
    await db.query('DROP TABLE IF EXISTS suppliers');
    
    // Create table without foreign key constraints initially
    await db.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        supplier_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        supplier_group_number INT,
        address VARCHAR(255),
        zip VARCHAR(50),
        city VARCHAR(100),
        country VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        currency VARCHAR(3),
        payment_terms_number INT,
        vat_number VARCHAR(50),
        corp_identification_number VARCHAR(50),
        default_delivery_location VARCHAR(100),
        barred BOOLEAN DEFAULT FALSE,
        creditor_id VARCHAR(50),
        payment_type_number INT,
        cost_account_number VARCHAR(50),
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (supplier_number, agreement_number),
        INDEX idx_agreement_number (agreement_number),
        INDEX idx_supplier_group (supplier_group_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    
    logger.info('Migration 008-suppliers completed successfully');
  } catch (error) {
    // Make sure to re-enable foreign key checks even if there's an error
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.error('Error running migration 008-suppliers:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 008-suppliers');
  
  try {
    // Disable foreign key checks temporarily
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    await db.query('DROP TABLE IF EXISTS suppliers');
    
    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    
    logger.info('Migration 008-suppliers reverted successfully');
  } catch (error) {
    // Make sure to re-enable foreign key checks even if there's an error
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.error('Error reverting migration 008-suppliers:', error.message);
    throw error;
  }
}

module.exports = { up, down };