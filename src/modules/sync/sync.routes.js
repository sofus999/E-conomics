const express = require('express');
const router = express.Router();
const syncController = require('./sync.controller');

// POST /api/sync - Sync all data
router.post('/', (req, res, next) => {
  syncController.syncAll(req, res, next);
});

module.exports = router;