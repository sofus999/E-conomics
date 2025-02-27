const express = require('express');
const supplierGroupController = require('./supplier-group.controller');

const router = express.Router();

// Sync routes
router.post('/sync', supplierGroupController.syncSupplierGroups);
router.post('/agreements/:id/sync', supplierGroupController.syncSupplierGroupsForAgreement);

// Get supplier groups
router.get('/agreements/:agreement_number', supplierGroupController.getSupplierGroups);
router.get('/agreements/:agreement_number/:group_number', supplierGroupController.getSupplierGroupByNumber);

module.exports = router;