// 015-journals.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 015-journals');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS journals (
        journal_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        min_voucher_number INT,
        max_voucher_number INT,
        entry_type_restricted_to VARCHAR(50),
        settings JSON,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (journal_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 015-journals completed successfully');
  } catch (error) {
    logger.error('Error running migration 015-journals:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 015-journals');
  
  try {
    await db.query('DROP TABLE IF EXISTS journals');
    
    logger.info('Migration 015-journals reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 015-journals:', error.message);
    throw error;
  }
}

module.exports = { up, down };