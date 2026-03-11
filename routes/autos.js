const express = require('express');
const router = express.Router();
const { autoPost, autoGet, autoGetMine, autoGetById, autoDelete, autoPut } = require('../controllers/auto');
const { protect } = require('../middlewares/auth');

// POST /api/autos (protected)
router.post('/', protect, autoPost);

// GET /api/autos
router.get('/', autoGet);

// GET /api/autos/mine (protected)
router.get('/mine', protect, autoGetMine);

// GET /api/autos/:id
router.get('/:id', autoGetById);

// PUT /api/autos/:id (protected)
router.put('/:id', protect, autoPut);

// DELETE /api/autos/:id (protected)
router.delete('/:id', protect, autoDelete);

module.exports = router;