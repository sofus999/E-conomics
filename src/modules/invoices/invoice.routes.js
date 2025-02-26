const express = require('express');
const invoiceController = require('./invoice.controller');

const router = express.Router();

// Sync routes
router.post('/sync', invoiceController.syncInvoices);
router.post('/sync/draft', invoiceController.syncDraftInvoices);
router.post('/sync/booked', invoiceController.syncBookedInvoices);

// Cleanup route
router.post('/cleanup', invoiceController.cleanupDuplicates);

// Get invoices
router.get('/', invoiceController.getInvoices);
router.get('/logs', invoiceController.getSyncLogs);
router.get('/:id', invoiceController.getInvoiceById);

// Agreement specific routes
router.get('/agreement/info', invoiceController.getAgreementInfo);
router.get('/agreement/invoices', invoiceController.getAgreementInvoices);
router.get('/agreement/statistics', invoiceController.getAgreementStatistics);

module.exports = router;