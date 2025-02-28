const express = require('express');
const customerController = require('./customer.controller');
const router = express.Router();

router.post('/sync', customerController.syncCustomers);
router.post('/agreements/:id/sync', customerController.syncCustomersForAgreement);
router.get('/agreements/:agreement_number', customerController.getCustomers);
router.get('/agreements/:agreement_number/:customer_number', customerController.getCustomerByNumber);

module.exports = router;