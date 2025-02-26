require('dotenv').config();

module.exports = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://restapi.e-conomic.com',
    appSecretToken: process.env.APP_SECRET_TOKEN,
    agreementGrantToken: process.env.AGREEMENT_GRANT_TOKEN,
    agreementNumber: process.env.AGREEMENT_NUMBER || null
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'economic_data',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10')
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    env: process.env.NODE_ENV || 'development'
  }
};