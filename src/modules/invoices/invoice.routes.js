const express = require('express');
const invoiceController = require('./invoice.controller');

const router = express.Router();

// Sync routes
router.post('/sync', invoiceController.syncInvoices);
router.post('/sync/draft', invoiceController.syncDraftInvoices);
router.post('/sync/booked', invoiceController.syncBookedInvoices);

// Get invoices
router.get('/', invoiceController.getInvoices);
router.get('/logs', invoiceController.getSyncLogs);
router.get('/:id', invoiceController.getInvoiceById);

module.exports = router;