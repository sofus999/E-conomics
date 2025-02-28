const express = require('express');
const departmentController = require('./department.controller');
const router = express.Router();

router.post('/sync', departmentController.syncDepartments);
router.post('/agreements/:id/sync', departmentController.syncDepartmentsForAgreement);
router.get('/agreements/:agreement_number', departmentController.getDepartments);
router.get('/agreements/:agreement_number/:department_number', departmentController.getDepartmentByNumber);

module.exports = router;