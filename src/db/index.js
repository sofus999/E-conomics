const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../modules/core/logger');

class Database {
  constructor() {
    // Connection configuration with authentication options
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit || 10,
      queueLimit: 0,
      // Force mysql_native_password authentication
      authPlugins: {
        mysql_native_password: () => ({ 
          auth: async () => Buffer.from(config.db.password)
        })
      }
    };

    this.pool = mysql.createPool(poolConfig);
    
    logger.info(`Database pool created with ${poolConfig.connectionLimit} connections`);
  }

  async query(sql, params = []) {
    try {
      const [rows, fields] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('Database query error:', error.message);
      logger.error('Query:', sql);
      logger.error('Params:', JSON.stringify(params));
      throw error;
    }
  }

  async getConnection() {
    try {
      return await this.pool.getConnection();
    } catch (error) {
      logger.error('Error getting database connection:', error.message);
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection closed');
    }
  }
}

module.exports = new Database();