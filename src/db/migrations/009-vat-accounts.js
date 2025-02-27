const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 009-vat-accounts');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS vat_accounts (
        vat_code VARCHAR(50) NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        vat_percentage DECIMAL(10,8) NOT NULL,
        account_number VARCHAR(50),
        contra_account_number VARCHAR(50),
        vat_type_number INT,
        vat_type_name VARCHAR(100),
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_code, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 009-vat-accounts completed successfully');
  } catch (error) {
    logger.error('Error running migration 009-vat-accounts:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 009-vat-accounts');
  
  try {
    await db.query('DROP TABLE IF EXISTS vat_accounts');
    
    logger.info('Migration 009-vat-accounts reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 009-vat-accounts:', error.message);
    throw error;
  }
}

module.exports = { up, down };