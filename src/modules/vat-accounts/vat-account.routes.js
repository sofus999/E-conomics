const express = require('express');
const vatAccountController = require('./vat-account.controller');

const router = express.Router();

// Sync routes
router.post('/sync', vatAccountController.syncVatAccounts);
router.post('/agreements/:id/sync', vatAccountController.syncVatAccountsForAgreement);

// Get VAT accounts
router.get('/agreements/:agreement_number', vatAccountController.getVatAccounts);
router.get('/agreements/:agreement_number/:vat_code', vatAccountController.getVatAccountByCode);

module.exports = router;