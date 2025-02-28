const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 009-accounting-years');
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS accounting_years (
      year VARCHAR(10) NOT NULL,
      agreement_number INT NOT NULL,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (year, agreement_number),
      INDEX idx_agreement_number (agreement_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    logger.info('Migration 009-accounting-years completed successfully');
  } catch (error) {
    logger.error('Error running migration 009-accounting-years:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 009-accounting-years');
  try {
    await db.query('DROP TABLE IF EXISTS accounting_years');
    logger.info('Migration 009-accounting-years reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 009-accounting-years:', error.message);
    throw error;
  }
}

module.exports = { up, down };
