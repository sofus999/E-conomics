const express = require('express');
const invoiceController = require('./invoice.controller');

const router = express.Router();

// Sync routes
router.post('/sync', invoiceController.syncInvoices);
router.post('/sync/draft', invoiceController.syncDraftInvoices);
router.post('/sync/booked', invoiceController.syncBookedInvoices);
router.post('/agreements/:id/sync', invoiceController.syncAgreementInvoices);

// Cleanup route
router.post('/cleanup', invoiceController.cleanupDuplicates);

// Get invoices
router.get('/', invoiceController.getInvoices);
router.get('/logs', invoiceController.getSyncLogs);
router.get('/:id', invoiceController.getInvoiceById);

// Agreement specific routes
router.get('/agreements', invoiceController.getAllAgreementsInfo);
router.get('/agreements/:agreement_number/invoices', invoiceController.getAgreementInvoices);
router.get('/agreements/:agreement_number/statistics', invoiceController.getAgreementStatistics);

module.exports = router;