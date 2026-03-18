const express = require('express');
const router = express.Router();
const { autoGetById } = require('../controllers/auto');

// GET /api/vehicles/:id (public)
router.get('/:id', autoGetById);

module.exports = router;
