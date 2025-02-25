const express = require('express');
const { errorHandler } = require('./modules/core/error.handler');
const logger = require('./modules/core/logger');

// Import routes
const invoiceRoutes = require('./modules/invoices/invoice.routes');

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Simple health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
app.use('/api/invoices', invoiceRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not Found', code: 'NOT_FOUND' } });
});

module.exports = app;