const express = require('express');
const accountingYearController = require('./accounting-year.controller');
const router = express.Router();

router.post('/sync', accountingYearController.syncAccountingYears);
router.post('/agreements/:id/sync', accountingYearController.syncAccountingYearsForAgreement);
router.get('/agreements/:agreement_number', accountingYearController.getAccountingYears);
router.get('/agreements/:agreement_number/:year', accountingYearController.getAccountingYearByYear);
router.get('/agreements/:agreement_number/:year/periods', accountingYearController.getAccountingPeriods);
router.get('/agreements/:agreement_number/:year/periods/:period_number', accountingYearController.getAccountingPeriodByNumber);
router.get('/agreements/:agreement_number/:year/periods/:period_number/entries', accountingYearController.getAccountingEntriesByPeriod);
router.get('/agreements/:agreement_number/:year/periods/:period_number/totals', accountingYearController.getAccountingTotalsByPeriod);

module.exports = router;