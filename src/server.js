const app = require('./app');
const config = require('./config');
const db = require('./db');
const logger = require('./modules/core/logger');
const { up } = require('./db/migrations/001-invoices');
const { up: migrateInvoices } = require('./db/migrations/001-invoices');
const { up: migrateAgreementNumber } = require('./db/migrations/002-agreement-number');

// Start the server
async function startServer() {
  try {
    // Run migrations
    await up();
    await migrateInvoices();
    await migrateAgreementNumber();
    logger.info('Database migrations completed');
    
    // Start the server
    const server = app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown function
function gracefulShutdown(server) {
  logger.info('Shutting down gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connection
      await db.close();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start the server
startServer();