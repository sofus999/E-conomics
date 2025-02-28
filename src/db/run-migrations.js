const fs = require('fs').promises;
const path = require('path');
const db = require('./index');
const logger = require('../modules/core/logger');

async function runMigrations() {
  try {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all migration files
    const migrationFiles = await fs.readdir(__dirname + '/migrations');
    const sortedMigrations = migrationFiles
      .filter(f => f.endsWith('.js'))
      .sort((a, b) => {
        const numA = parseInt(a.split('-')[0]);
        const numB = parseInt(b.split('-')[0]);
        return numA - numB;
      });

    // Get executed migrations
    const executed = await db.query('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.map(row => row.filename));

    // Run pending migrations
    for (const file of sortedMigrations) {
      if (!executedFiles.has(file)) {
        logger.info(`Running migration: ${file}`);
        const migration = require(path.join(__dirname, 'migrations', file));
        
        try {
          await migration.up();
          await db.query('INSERT INTO migrations (filename) VALUES (?)', [file]);
          logger.info(`Completed migration: ${file}`);
        } catch (err) {
          logger.error(`Failed to run migration ${file}:`, err);
          throw err;
        }
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = runMigrations;
