const express = require('express');
const syncController = require('../modules/sync/sync.controller');
const router = express.Router();

// POST /api/sync - Sync all data
router.post('/', syncController.syncAll.bind(syncController));

module.exports = router;
