const express = require('express');
const accountController = require('./account.controller');
const router = express.Router();

router.post('/sync', accountController.syncAccounts);
router.post('/agreements/:id/sync', accountController.syncAccountsForAgreement);
router.get('/agreements/:agreement_number', accountController.getAccounts);
router.get('/agreements/:agreement_number/:account_number', accountController.getAccountByNumber);

module.exports = router;