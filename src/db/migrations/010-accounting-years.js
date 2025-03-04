// src/db/migrations/010-accounting-years.js
const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
  logger.info('Running migration: 010-accounting-years');
  
  try {
    // Create accounting_years table first
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounting_years (
        year_id VARCHAR(10) NOT NULL,
        agreement_number INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        closed BOOLEAN DEFAULT FALSE,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (year_id, agreement_number),
        FOREIGN KEY (agreement_number) REFERENCES agreement_configs(agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create accounting_periods table
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounting_periods (
        period_number INT NOT NULL,
        year_id VARCHAR(10) NOT NULL,
        agreement_number INT NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        barred BOOLEAN DEFAULT FALSE,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (period_number, year_id, agreement_number),
        FOREIGN KEY (year_id, agreement_number) REFERENCES accounting_years(year_id, agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create accounting_entries table
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounting_entries (
        entry_number INT NOT NULL,
        year_id VARCHAR(10) NOT NULL,
        period_number INT NOT NULL,
        agreement_number INT NOT NULL,
        account_number INT NOT NULL,
        amount DECIMAL(15,2),
        amount_in_base_currency DECIMAL(15,2),
        currency VARCHAR(3),
        entry_date DATE,
        entry_text TEXT,
        entry_type VARCHAR(50),
        voucher_number INT,
        self_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (entry_number, year_id, agreement_number),
        INDEX idx_account (account_number),
        INDEX idx_period_year (period_number, year_id, agreement_number),
        INDEX idx_entry_date (entry_date),
        FOREIGN KEY (year_id, agreement_number) REFERENCES accounting_years(year_id, agreement_number),
        FOREIGN KEY (period_number, year_id, agreement_number) REFERENCES accounting_periods(period_number, year_id, agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create accounting_totals table
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounting_totals (
        account_number INT NOT NULL,
        year_id VARCHAR(10) NOT NULL,
        period_number INT NOT NULL, 
        agreement_number INT NOT NULL,
        total_in_base_currency DECIMAL(15,2),
        from_date DATE,
        to_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (account_number, year_id, period_number, agreement_number),
        FOREIGN KEY (year_id, agreement_number) REFERENCES accounting_years(year_id, agreement_number),
        FOREIGN KEY (period_number, year_id, agreement_number) REFERENCES accounting_periods(period_number, year_id, agreement_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    logger.info('Migration 010-accounting-years completed successfully');
  } catch (error) {
    logger.error('Error running migration 010-accounting-years:', error.message);
    throw error;
  }
}

async function down() {
  logger.info('Reverting migration: 010-accounting-years');
  
  try {
    // Drop tables in reverse order due to foreign key constraints
    await db.query('DROP TABLE IF EXISTS accounting_totals');
    await db.query('DROP TABLE IF EXISTS accounting_entries');
    await db.query('DROP TABLE IF EXISTS accounting_periods');
    await db.query('DROP TABLE IF EXISTS accounting_years');
    
    logger.info('Migration 010-accounting-years reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 010-accounting-years:', error.message);
    throw error;
  }
}

module.exports = { up, down };