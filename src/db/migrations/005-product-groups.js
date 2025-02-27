const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 005-product-groups');
  
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_groups (
        product_group_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50),
        accrual_account_number VARCHAR(50),
        products_count INT DEFAULT 0,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (product_group_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 005-product-groups completed successfully');
  } catch (error) {
    logger.error('Error running migration 005-product-groups:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 005-product-groups');
  
  try {
    await db.query('DROP TABLE IF EXISTS product_groups');
    
    logger.info('Migration 005-product-groups reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 005-product-groups:', error.message);
    throw error;
  }
}

module.exports = { up, down };