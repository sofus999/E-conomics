const express = require('express');
const supplierController = require('./supplier.controller');

const router = express.Router();

// Sync routes
router.post('/sync', supplierController.syncSuppliers);
router.post('/agreements/:id/sync', supplierController.syncSuppliersForAgreement);

// Get suppliers
router.get('/agreements/:agreement_number', supplierController.getSuppliers);
router.get('/agreements/:agreement_number/:supplier_number', supplierController.getSupplierByNumber);

module.exports = router;