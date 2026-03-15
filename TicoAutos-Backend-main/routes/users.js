const express = require('express');
const router = express.Router();
const { userRegister, userLogin, getMe, updateMe } = require('../controllers/user');
const { protect } = require('../middlewares/auth');
const { optionalMulterProfile } = require('../middlewares/upload');

// POST /api/users/register
router.post('/register', userRegister);

// POST /api/users/login
router.post('/login', userLogin);

// GET /api/users/me (protected)
router.get('/me', protect, getMe);

// PATCH /api/users/me (protected - actualizar nombre y/o foto_perfil; multipart con 'foto_perfil' para subir imagen)
router.patch('/me', protect, optionalMulterProfile, updateMe);

module.exports = router;