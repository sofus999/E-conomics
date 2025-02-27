const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 007-supplier-groups');
  
  try {
    // Disable foreign key checks temporarily
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Create table without foreign key constraints
    await db.query(`
      CREATE TABLE IF NOT EXISTS supplier_groups (
        supplier_group_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50),
        suppliers_count INT DEFAULT 0,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (supplier_group_number, agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    
    logger.info('Migration 007-supplier-groups completed successfully');
  } catch (error) {
    // Make sure to re-enable foreign key checks even if there's an error
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.error('Error running migration 007-supplier-groups:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 007-supplier-groups');
  
  try {
    // Disable foreign key checks temporarily
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop only supplier_groups table
    await db.query('DROP TABLE IF EXISTS supplier_groups');
    
    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    
    logger.info('Migration 007-supplier-groups reverted successfully');
  } catch (error) {
    // Make sure to re-enable foreign key checks even if there's an error
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    logger.error('Error reverting migration 007-supplier-groups:', error.message);
    throw error;
  }
}

module.exports = { up, down };