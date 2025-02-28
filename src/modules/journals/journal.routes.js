const express = require('express');
const journalController = require('./journal.controller');
const router = express.Router();

router.post('/sync', journalController.syncJournals);
router.post('/agreements/:id/sync', journalController.syncJournalsForAgreement);
router.get('/agreements/:agreement_number', journalController.getJournals);
router.get('/agreements/:agreement_number/:journal_number', journalController.getJournalByNumber);

module.exports = router;