const express = require('express');
const accountingYearController = require('./accounting-year.controller');
const router = express.Router();

// Sync routes for accounting years
router.post('/sync', accountingYearController.syncAccountingYears);
router.post('/agreements/:id/sync', accountingYearController.syncAccountingYearsForAgreement);

module.exports = router;