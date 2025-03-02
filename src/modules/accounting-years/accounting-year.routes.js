const express = require('express');
const accountingYearController = require('./accounting-year.controller');
const router = express.Router();

// Sync routes
router.post('/sync', accountingYearController.syncAccountingYears);
router.post('/agreements/:id/sync', accountingYearController.syncAccountingYearsForAgreement);

// Year routes
router.get('/agreements/:agreement_number', accountingYearController.getAccountingYears);
router.get('/agreements/:agreement_number/:year', accountingYearController.getAccountingYearByYear);

// Period routes
router.get('/agreements/:agreement_number/:year/periods', accountingYearController.getAccountingPeriods);
router.get('/agreements/:agreement_number/:year/periods/:period_number', accountingYearController.getAccountingPeriodByNumber);

// Entries and totals routes
router.get('/agreements/:agreement_number/:year/periods/:period_number/entries', accountingYearController.getAccountingEntriesByPeriod);
router.get('/agreements/:agreement_number/:year/periods/:period_number/totals', accountingYearController.getAccountingTotalsByPeriod);

// On-demand sync routes
router.post('/agreements/:id/:year/periods/:period_number/entries/sync', accountingYearController.syncAccountingPeriodEntries);
router.post('/agreements/:id/:year/periods/:period_number/totals/sync', accountingYearController.syncAccountingPeriodTotals);
router.post('/agreements/:id/:year/totals/sync', accountingYearController.syncAccountingYearTotals);

module.exports = router;