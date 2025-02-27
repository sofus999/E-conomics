const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 004-payment-terms');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_terms (
        payment_terms_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        days_of_credit INT,
        payment_terms_type VARCHAR(50),
        description VARCHAR(255),
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (payment_terms_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 004-payment-terms completed successfully');
  } catch (error) {
    logger.error('Error running migration 004-payment-terms:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 004-payment-terms');
  
  try {
    await db.query('DROP TABLE IF EXISTS payment_terms');
    
    logger.info('Migration 004-payment-terms reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 004-payment-terms:', error.message);
    throw error;
  }
}

module.exports = { up, down };