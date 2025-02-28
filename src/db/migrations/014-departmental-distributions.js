// 014-departmental-distributions.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 014-departmental-distributions');
  
  try {
    // Create departmental distributions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS departmental_distributions (
        departmental_distribution_number INT NOT NULL,
        agreement_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        barred BOOLEAN DEFAULT FALSE,
        distribution_type VARCHAR(50),
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (departmental_distribution_number, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number),
        INDEX idx_agreement_number (agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create distribution percentages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS distribution_percentages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        departmental_distribution_number INT NOT NULL,
        agreement_number INT NOT NULL,
        department_number INT NOT NULL,
        percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (departmental_distribution_number, agreement_number) 
          REFERENCES departmental_distributions(departmental_distribution_number, agreement_number),
        FOREIGN KEY (department_number, agreement_number)
          REFERENCES departments(department_number, agreement_number),
        INDEX idx_departmental_distribution (departmental_distribution_number, agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 014-departmental-distributions completed successfully');
  } catch (error) {
    logger.error('Error running migration 014-departmental-distributions:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 014-departmental-distributions');
  
  try {
    // Drop the tables in reverse order due to foreign key constraints
    await db.query('DROP TABLE IF EXISTS distribution_percentages');
    await db.query('DROP TABLE IF EXISTS departmental_distributions');
    
    logger.info('Migration 014-departmental-distributions reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 014-departmental-distributions:', error.message);
    throw error;
  }
}

module.exports = { up, down };