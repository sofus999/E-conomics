const express = require('express');
const agreementController = require('./agreement.controller');

const router = express.Router();

// Get all agreements
router.get('/', agreementController.getAllAgreements);

// Get agreement by ID
router.get('/:id', agreementController.getAgreementById);

// Create a new agreement
router.post('/', agreementController.createAgreement);

// Create a new agreement with just a token
router.post('/register-token', agreementController.createAgreementFromToken);

// Update an agreement
router.put('/:id', agreementController.updateAgreement);

// Delete an agreement
router.delete('/:id', agreementController.deleteAgreement);

// Test agreement connection
router.post('/test-connection', agreementController.testAgreementConnection);

// Verify and update agreement from API
router.post('/:id/verify', agreementController.verifyAgreement);

module.exports = router;