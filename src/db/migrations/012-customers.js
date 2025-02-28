// 012-customers.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 012-customers');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        currency VARCHAR(3),
        payment_terms_number INT,
        customer_group_number INT,
        address VARCHAR(255),
        balance DECIMAL(15,2) DEFAULT 0.00,
        due_amount DECIMAL(15,2) DEFAULT 0.00,
        corporate_identification_number VARCHAR(50),
        city VARCHAR(100),
        country VARCHAR(100),
        email VARCHAR(255),
        zip VARCHAR(20),
        telephone_and_fax_number VARCHAR(50),
        vat_zone_number INT,
        last_updated DATETIME,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 012-customers completed successfully');
  } catch (error) {
    logger.error('Error running migration 012-customers:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 012-customers');
  
  try {
    await db.query('DROP TABLE IF EXISTS customers');
    
    logger.info('Migration 012-customers reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 012-customers:', error.message);
    throw error;
  }
}

module.exports = { up, down };