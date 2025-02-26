const db = require('../index');
const logger = require('../../modules/core/logger');

async function up() {
    logger.info('Running migration: 002-agreement-number');
    
    try {
      // Check if column exists
      const columns = await db.query('SHOW COLUMNS FROM invoices LIKE "agreement_number"');
      
      // Only add column if it doesn't exist
      if (columns.length === 0) {
        await db.query(`
          ALTER TABLE invoices 
          ADD COLUMN agreement_number INT AFTER customer_number
        `);
      }
      
      // Check if index exists and add if needed
      const indices = await db.query('SHOW INDEX FROM invoices WHERE Key_name = "idx_agreement_number"');
      if (indices.length === 0) {
        await db.query('CREATE INDEX idx_agreement_number ON invoices (agreement_number)');
      }
      
      // Create or replace view
      await db.query(`
        CREATE OR REPLACE VIEW agreement_invoices AS
        SELECT 
            agreement_number,
            payment_status,
            COUNT(*) as count,
            SUM(net_amount) as total_net_amount,
            SUM(gross_amount) as total_gross_amount
        FROM 
            invoices
        GROUP BY 
            agreement_number, payment_status
        ORDER BY 
            agreement_number, payment_status
      `);
      
      logger.info('Migration 002-agreement-number completed successfully');
    } catch (error) {
      logger.error('Error running migration 002-agreement-number:', error.message);
      throw error;
    }
  }

async function down() {
  logger.info('Reverting migration: 002-agreement-number');
  
  try {
    // Drop the index first
    await db.query('DROP INDEX idx_agreement_number ON invoices');
    
    // Drop the column
    await db.query('ALTER TABLE invoices DROP COLUMN agreement_number');
    
    // Drop the view
    await db.query('DROP VIEW IF EXISTS agreement_invoices');
    
    logger.info('Migration 002-agreement-number reverted successfully');
  } catch (error) {
    logger.error('Error reverting migration 002-agreement-number:', error.message);
    throw error;
  }
}

module.exports = { up, down };