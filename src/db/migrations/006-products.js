const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 006-products');
  
  try {
    // Drop existing table if it exists (this will remove all constraints)
    await db.query('DROP TABLE IF EXISTS products');
    
    // Create table without foreign key constraints
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_number VARCHAR(50) NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        product_group_number INT,
        description TEXT,
        unit VARCHAR(50),
        price DECIMAL(15,2),
        cost_price DECIMAL(15,2),
        recommended_price DECIMAL(15,2),
        is_accessible BOOLEAN DEFAULT TRUE,
        inventory INT,
        barred BOOLEAN DEFAULT FALSE,
        last_updated DATE,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (product_number, agreement_number),
        INDEX idx_agreement_number (agreement_number),
        INDEX idx_product_group (product_group_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 006-products completed successfully');
  } catch (error) {
    logger.error('Error running migration 006-products:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 006-products');
  
  try {
    await db.query('DROP TABLE IF EXISTS products');
    
    logger.info('Migration 006-products reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 006-products:', error.message);
    throw error;
  }
}

module.exports = { up, down };