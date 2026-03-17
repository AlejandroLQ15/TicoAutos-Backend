const express = require('express');
const router = express.Router();
const { autoPost, autoGet, autoGetMine, autoGetById, autoDelete, autoPut } = require('../controllers/auto');
const { protect } = require('../middlewares/auth');
const { optionalMulter } = require('../middlewares/upload');

// POST /api/autos (protected) - acepta JSON o multipart con fotos
router.post('/', protect, optionalMulter, autoPost);

// GET /api/autos
router.get('/', autoGet);

// GET /api/autos/mine (protected)
router.get('/mine', protect, autoGetMine);

// GET /api/autos/mis (protected) - alias para frontend
router.get('/mis', protect, autoGetMine);

// GET /api/autos/:id
router.get('/:id', autoGetById);

// PUT /api/autos/:id (protected) - acepta JSON o multipart para actualizar fotos
router.put('/:id', protect, optionalMulter, autoPut);

// PATCH /api/autos/:id (protected) - ej. marcar como vendido
router.patch('/:id', protect, autoPut);

// DELETE /api/autos/:id (protected)
router.delete('/:id', protect, autoDelete);

module.exports = router;