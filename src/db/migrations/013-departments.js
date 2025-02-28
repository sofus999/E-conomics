// 013-departments.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 013-departments');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS departments (
        department_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (department_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 013-departments completed successfully');
  } catch (error) {
    logger.error('Error running migration 013-departments:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 013-departments');
  
  try {
    await db.query('DROP TABLE IF EXISTS departments');
    
    logger.info('Migration 013-departments reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 013-departments:', error.message);
    throw error;
  }
}

module.exports = { up, down };