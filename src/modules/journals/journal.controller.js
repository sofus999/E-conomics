const journalService = require('./journal.service');
const logger = require('../core/logger');

class JournalController {
  async syncJournals(req, res, next) {
    try {
      const result = await journalService.syncAllJournals();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async syncJournalsForAgreement(req, res, next) {
    try {
      const { id } = req.params;
      const agreement = await require('../agreements/agreement.model').getById(id);
      const result = await journalService.syncJournalsForAgreement(agreement);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
  
  async getJournals(req, res, next) {
    try {
      const { agreement_number } = req.params;
      const journals = await journalService.getJournalsByAgreement(parseInt(agreement_number));
      res.json(journals);
    } catch (error) {
      next(error);
    }
  }
  
  async getJournalByNumber(req, res, next) {
    try {
      const { agreement_number, journal_number } = req.params;
      const journal = await journalService.getJournalByNumber(
        parseInt(journal_number), 
        parseInt(agreement_number)
      );
      res.json(journal);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new JournalController();