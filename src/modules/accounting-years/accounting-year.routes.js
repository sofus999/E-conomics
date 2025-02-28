const express = require('express');
const accountingYearController = require('./accounting-year.controller');
const router = express.Router();

router.post('/sync', accountingYearController.syncAccountingYears);
router.post('/agreements/:id/sync', accountingYearController.syncAccountingYearsForAgreement);
router.get('/agreements/:agreement_number', accountingYearController.getAccountingYears);
router.get('/agreements/:agreement_number/:year', accountingYearController.getAccountingYearByYear);

module.exports = router;