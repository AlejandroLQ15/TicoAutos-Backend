const express = require('express');
const router = express.Router();
const { userRegister, userLogin, getMe, updateMe, getCedulaInfo, activateEmail, resendActivationEmail, verify2FA, resend2FACode, toggle2FA } = require('../controllers/user');
const { protect } = require('../middlewares/auth');
const { optionalMulterProfile } = require('../middlewares/upload');

// GET /api/users/cedula/:cedula - consulta el padrón electoral y devuelve nombre/apellidos
router.get('/cedula/:cedula', getCedulaInfo);

// POST /api/users/register
router.post('/register', userRegister);

// POST /api/users/login
router.post('/login', userLogin);

// GET /api/users/activate?token=... - activa cuenta por enlace de correo
router.get('/activate', activateEmail);

// POST /api/users/resend-activation - reenvía correo de activación
router.post('/resend-activation', resendActivationEmail);

// POST /api/users/verify-2fa - verifica código OTP y devuelve JWT final
router.post('/verify-2fa', verify2FA);

// POST /api/users/resend-2fa - reenvía código OTP SMS
router.post('/resend-2fa', resend2FACode);

// GET /api/users/me (protected)
router.get('/me', protect, getMe);

// PATCH /api/users/me (protected - actualizar nombre y/o foto_perfil; multipart con 'foto_perfil' para subir imagen)
router.patch('/me', protect, optionalMulterProfile, updateMe);

// PATCH /api/users/me/2fa (protected - activar o desactivar 2FA)
router.patch('/me/2fa', protect, toggle2FA);

module.exports = router;