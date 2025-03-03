const express = require('express');
const invoiceController = require('./invoice.controller');

const router = express.Router();

// Main sync route - syncs all invoice types across all agreements
router.post('/sync', invoiceController.syncAllInvoices);

// Agreement-specific sync route
router.post('/agreements/:id/sync', invoiceController.syncAgreementInvoices);

// Cleanup route for duplicate invoices
router.post('/cleanup', invoiceController.cleanupDuplicates);

module.exports = router;