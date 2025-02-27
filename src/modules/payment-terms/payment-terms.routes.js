const express = require('express');
const paymentTermsController = require('./payment-terms.controller');

const router = express.Router();

// Sync routes
router.post('/sync', paymentTermsController.syncPaymentTerms);
router.post('/agreements/:id/sync', paymentTermsController.syncPaymentTermsForAgreement);

// Get payment terms
router.get('/agreements/:agreement_number', paymentTermsController.getPaymentTerms);
router.get('/agreements/:agreement_number/:terms_number', paymentTermsController.getPaymentTermByNumber);

module.exports = router;