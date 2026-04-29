const express = require('express');
const router = express.Router();
const { autoPost, autoGet, autoGetMine, autoGetById, autoDelete, autoPut } = require('../controllers/auto');
const { protect } = require('../middlewares/auth');
const { optionalMulter } = require('../middlewares/upload');

// POST /api/vehicles (protected) - alias de /api/autos
router.post('/', protect, optionalMulter, autoPost);

// GET /api/vehicles
router.get('/', autoGet);

// GET /api/vehicles/mine (protected)
router.get('/mine', protect, autoGetMine);

// GET /api/vehicles/mis (protected)
router.get('/mis', protect, autoGetMine);

// GET /api/vehicles/:id (public)
router.get('/:id', autoGetById);

// PUT /api/vehicles/:id (protected)
router.put('/:id', protect, optionalMulter, autoPut);

// PATCH /api/vehicles/:id (protected)
router.patch('/:id', protect, autoPut);

// DELETE /api/vehicles/:id (protected)
router.delete('/:id', protect, autoDelete);

module.exports = router;
