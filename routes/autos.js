const express = require('express');
const router = express.Router();
const { autoPost, autoGet, autoGetById, autoDelete } = require('../controllers/auto');

// POST /api/autos
router.post('/', autoPost);

// GET /api/autos
router.get('/', autoGet);

// GET /api/autos/:id
router.get('/:id', autoGetById);

// DELETE /api/autos/:id
router.delete('/:id', autoDelete);

module.exports = router;