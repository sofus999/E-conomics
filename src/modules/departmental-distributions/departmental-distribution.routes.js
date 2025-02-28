const express = require('express');
const departmentalDistributionController = require('./departmental-distribution.controller');
const router = express.Router();

router.post('/sync', departmentalDistributionController.syncDistributions);
router.post('/agreements/:id/sync', departmentalDistributionController.syncDistributionsForAgreement);
router.get('/agreements/:agreement_number', departmentalDistributionController.getDistributions);
router.get('/agreements/:agreement_number/:distribution_number', departmentalDistributionController.getDistributionByNumber);

module.exports = router;