const express = require('express');
const productController = require('./product.controller');

const router = express.Router();

// Sync routes
router.post('/sync', productController.syncProducts);
router.post('/agreements/:id/sync', productController.syncProductsForAgreement);

// Get products
router.get('/agreements/:agreement_number', productController.getProducts);
router.get('/agreements/:agreement_number/:product_number', productController.getProductByNumber);

module.exports = router;