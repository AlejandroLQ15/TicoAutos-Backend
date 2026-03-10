const express = require('express');
const router = express.Router();
const { autoPost, autoGet, autoGetById, autoDelete } = require('../controllers/auto');
const { protect } = require('../middlewares/auth');

// POST /api/autos (protected)
router.post('/', protect, autoPost);

// GET /api/autos
router.get('/', autoGet);

// GET /api/autos/:id
router.get('/:id', autoGetById);

// DELETE /api/autos/:id (protected)
router.delete('/:id', protect, autoDelete);

module.exports = router;