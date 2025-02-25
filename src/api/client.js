const axios = require('axios');
const config = require('../config');
const logger = require('../modules/core/logger');

class ApiClient {
  constructor() {
    this.baseUrl = config.api.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-AppSecretToken': config.api.appSecretToken,
        'X-AgreementGrantToken': config.api.agreementGrantToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    // Add request logging
    this.client.interceptors.request.use(request => {
      logger.debug(`API Request: ${request.method.toUpperCase()} ${request.baseURL}${request.url}`);
      return request;
    });
    
    // Add response logging
    this.client.interceptors.response.use(
      response => {
        logger.debug(`API Response: ${response.status} from ${response.config.url}`);
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} from ${error.config.url}`);
          logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        } else {
          logger.error(`API Request failed: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  async get(endpoint, params = {}) {
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      logger.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getPaginated(endpoint, params = {}) {
    const results = [];
    let currentPage = `${endpoint}?skippages=0&pagesize=100`;
    
    try {
      while (currentPage) {
        // Extract path from full URL if needed
        const path = currentPage.startsWith(this.baseUrl) 
          ? currentPage.substring(this.baseUrl.length) 
          : currentPage;
          
        const response = await this.client.get(path);
        
        if (response.data.collection) {
          results.push(...response.data.collection);
        }
        
        // Check if there's a next page
        currentPage = response.data.pagination?.nextPage || null;
      }
      
      return results;
    } catch (error) {
      logger.error(`API Pagination Error (${endpoint}):`, error.message);
      throw error;
    }
  }
}

module.exports = new ApiClient();