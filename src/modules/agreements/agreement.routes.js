const express = require('express');
const agreementController = require('./agreement.controller');

const router = express.Router();

// Get all agreements
router.get('/', agreementController.getAllAgreements);

// Get agreement by ID
router.get('/:id', agreementController.getAgreementById);

// Create a new agreement
router.post('/', agreementController.createAgreement);

// Update an agreement
router.put('/:id', agreementController.updateAgreement);

// Delete an agreement
router.delete('/:id', agreementController.deleteAgreement);

// Test agreement connection
router.post('/test-connection', agreementController.testAgreementConnection);

module.exports = router;