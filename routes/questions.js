const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { questionPost, questionGetByVehicle, questionGetMine, questionBlockUpdate } = require('../controllers/question');

// POST /api/questions (protected)
router.post('/', protect, questionPost);

// GET /api/questions/mine (protected)
router.get('/mine', protect, questionGetMine);

// GET /api/questions/vehicle/:vehiculoId
router.get('/vehicle/:vehiculoId', questionGetByVehicle);

// PUT/PATCH /api/questions/:id -> blocked by requirement
router.put('/:id', protect, questionBlockUpdate);
router.patch('/:id', protect, questionBlockUpdate);

module.exports = router;
