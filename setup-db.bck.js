require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const authGssapiClient = require('./src/db/auth_plugins/auth_gssapi_client');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Function to log messages to a file
const logToFile = (message) => {
  const logFilePath = path.join(logsDir, 'setup-db.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
};

// Enhanced logger to log to both console and file
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
  logToFile(message);
};

async function setupDatabase() {
  log('Starting database setup...');
  let connection;
  
  try {
    // Connection configuration with explicit authentication method
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      // Force mysql_native_password authentication
      authPlugins: {
        mysql_native_password: () => ({ 
          auth: async () => Buffer.from(process.env.DB_PASSWORD || '')
        })
      }
    };
    
    // Try to connect with explicit authentication method
    try {
      log('Connecting to MariaDB server...');
      connection = await mysql.createConnection(config);
      log('Connected to MariaDB server');
    } catch (err) {
      log(`Error connecting with first method: ${err.message}`);
      
      // Try alternate connection method
      config.authPlugin = 'mysql_native_password';
      delete config.authPlugins;
      
      log('Trying alternate connection method...');
      connection = await mysql.createConnection(config);
      log('Connected with alternate method');
    }
    
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'economic_data';
    log(`Creating database '${dbName}' if it doesn't exist...`);
    
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`${dbName}\`
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    
    log(`Database '${dbName}' created or verified`);
    
    // Create user with appropriate permissions if needed
    if (process.env.CREATE_DB_USER === 'true') {
      const dbUser = process.env.DB_APP_USER || 'economic_api';
      const dbUserPass = process.env.DB_APP_PASSWORD || 'password';
      
      log(`Creating database user '${dbUser}' if it doesn't exist...`);
      
      // Create user (ignoring error if exists)
      try {
        await connection.query(`
          CREATE USER IF NOT EXISTS '${dbUser}'@'%' 
          IDENTIFIED BY '${dbUserPass}'
        `);
      } catch (err) {
        log(`Note: ${err.message}`);
      }
      
      // Grant permissions
      try {
        await connection.query(`
          GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'
        `);
        
        await connection.query('FLUSH PRIVILEGES');
        log(`Permissions granted to '${dbUser}'`);
      } catch (err) {
        log(`Warning: Could not grant permissions: ${err.message}`);
      }
    }
    
    log('Database setup completed successfully');
    
  } catch (error) {
    log(`Error setting up database: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      log('Database connection closed');
    }
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      log('Setup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      log(`Setup failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = setupDatabase;