const express = require('express');
const router = express.Router();
const { googleAuth, googleCallback, googleRegister } = require('../controllers/auth');

// GET /api/auth/google — redirige a Google para autenticación
router.get('/google', googleAuth);

// GET /api/auth/google/callback — Google redirige aquí tras autenticar
router.get('/google/callback', googleCallback);

// POST /api/auth/google/register — completa registro de nuevo usuario de Google (requiere cédula)
router.post('/google/register', googleRegister);

module.exports = router;
