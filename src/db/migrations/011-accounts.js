// 011-accounts.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 011-accounts');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        account_number INT NOT NULL,
        agreement_number INT NOT NULL,
        account_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        debit_credit ENUM('debit', 'credit') NOT NULL,
        block_direct_entries BOOLEAN DEFAULT FALSE,
        vat_code VARCHAR(50),
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (account_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 011-accounts completed successfully');
  } catch (error) {
    logger.error('Error running migration 011-accounts:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 011-accounts');
  
  try {
    await db.query('DROP TABLE IF EXISTS accounts');
    
    logger.info('Migration 011-accounts reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 011-accounts:', error.message);
    throw error;
  }
}

module.exports = { up, down };