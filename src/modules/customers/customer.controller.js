const customerService = require('./customer.service');
const logger = require('../core/logger');

class CustomerController {
  async syncCustomers(req, res, next) {
    try {
      const result = await customerService.syncAllCustomers();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncCustomersForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await customerService.syncCustomersForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async getCustomers(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const customers = await customerService.getCustomersByAgreement(parseInt(agreement_number));
      res.json(customers);
    } catch (error) {
      next(error);
    }
  }
  
  async getCustomerByNumber(req, res, next) {
    try {
      const { agreement_number, customer_number } = req.params;
      const customer = await customerService.getCustomerByNumber(
        parseInt(customer_number), 
        parseInt(agreement_number)
      );
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomerController();