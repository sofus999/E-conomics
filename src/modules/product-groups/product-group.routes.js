const express = require('express');
const productGroupController = require('./product-group.controller');

const router = express.Router();

// Sync routes
router.post('/sync', productGroupController.syncProductGroups);
router.post('/agreements/:id/sync', productGroupController.syncProductGroupsForAgreement);

// Get product groups
router.get('/agreements/:agreement_number', productGroupController.getProductGroups);
router.get('/agreements/:agreement_number/:group_number', productGroupController.getProductGroupByNumber);

module.exports = router;