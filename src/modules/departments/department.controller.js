const departmentService = require('./department.service');
const logger = require('../core/logger');

class DepartmentController {
  async syncDepartments(req, res, next) {
    try {
      const result = await departmentService.syncAllDepartments();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncDepartmentsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await departmentService.syncDepartmentsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async getDepartments(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const departments = await departmentService.getDepartmentsByAgreement(parseInt(agreement_number));
      res.json(departments);
    } catch (error) {
      next(error);
    }
  }
  
  async getDepartmentByNumber(req, res, next) {
    try {
      const { agreement_number, department_number } = req.params;
      const department = await departmentService.getDepartmentByNumber(
        parseInt(department_number), 
        parseInt(agreement_number)
      );
      res.json(department);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DepartmentController();