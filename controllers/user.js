const User = require('../models/users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateToken, generateOTP, hashToken, expiresInMinutes, expiresInHours, normalizeCRPhone } = require('../utils/security/tokens');
const { sendActivationEmail } = require('../services/email/sendgrid');
const { sendSMSCode } = require('../services/sms/twilio');

// ── Constantes de configuración ──────────────────────────────────────────────
const ACTIVATION_TTL_HOURS   = parseInt(process.env.ACTIVATION_TOKEN_TTL_HOURS || '24', 10);
const ACTIVATION_RESEND_COOLDOWN_SECONDS = parseInt(process.env.ACTIVATION_RESEND_COOLDOWN_SECONDS || '60', 10);
const ACTIVATION_COOLDOWN_MS = ACTIVATION_RESEND_COOLDOWN_SECONDS * 1000;
const MFA_TTL_MINUTES        = parseInt(process.env.MFA_CODE_TTL_MINUTES || '10', 10);
const MFA_COOLDOWN_MS        = 2 * 60 * 1000;   // 2 minutos entre reenvíos de SMS
const MFA_MAX_ATTEMPTS       = 5;               // intentos antes de invalidar el código
const PENDING_LOGIN_TTL_MIN  = MFA_TTL_MINUTES + 2; // algo más que el OTP

const jwtSecret = () => (process.env.JWT_SECRET || process.env.SECRET_KEY || 'ticoautos_secret_key_2026').trim();
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://127.0.0.1:5500').replace(/\/$/, '');

// Consulta el API de cédulas externo y devuelve el nombre completo
const getCedulaInfo = async (req, res) => {
  const { cedula } = req.params;
  if (!/^\d{9}$/.test(cedula)) {
    return res.status(400).json({ success: false, message: 'Formato de cédula inválido. Debe tener 9 dígitos.' });
  }
  try {
    const apiBase = (process.env.CEDULA_API_URL || 'https://apis.gometa.org/cedulas').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/${cedula}`);
    if (!response.ok) {
      return res.status(404).json({ success: false, message: 'Cédula no encontrada en el padrón electoral.' });
    }
    const data = await response.json();
    // Compatibilidad con gometa.org: data.nombre o data.results[0].firstname + lastnames
    const nombre = data.nombre ||
      (data.results?.[0]
        ? [data.results[0].firstname, data.results[0].lastname1, data.results[0].lastname2].filter(Boolean).join(' ')
        : '');
    if (!nombre || data.resultcount === 0) {
      return res.status(404).json({ success: false, message: 'Cédula no encontrada en el padrón electoral.' });
    }
    res.json({ success: true, nombre });
  } catch (error) {
    console.error('Error consultando API de cédulas:', error.message);
    res.status(503).json({ success: false, message: 'Servicio de validación de cédulas no disponible.' });
  }
};

// ── Registro: crea cuenta en estado pendiente y envía correo de activación ──
const userRegister = async (req, res) => {
  try {
    const { username, password, nombre, cedula, email, telefono } = req.body;

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
    }
    if (!cedula || !/^\d{9}$/.test(cedula.trim())) {
      return res.status(400).json({ success: false, message: 'La cédula es obligatoria y debe tener 9 dígitos.' });
    }
    if (!email || email.trim() === '') {
      return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
    }
    if (!telefono || telefono.trim() === '') {
      return res.status(400).json({ success: false, message: 'El teléfono es obligatorio.' });
    }
    const normalizedPhone = normalizeCRPhone(telefono.trim());
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'El teléfono debe ser válido (ejemplo: 88001234 o +50688001234).' });
    }
    if (!username || username.trim() === '') {
      return res.status(400).json({ success: false, message: 'El nombre de usuario es obligatorio.' });
    }
    if (!password || password.trim() === '') {
      return res.status(400).json({ success: false, message: 'La contraseña es obligatoria.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { cedula: cedula.trim() }, { email: email.trim().toLowerCase() }] });
    if (existingUser) {
      if (existingUser.username === username.trim()) return res.status(409).json({ success: false, message: 'El nombre de usuario ya está en uso.' });
      if (existingUser.cedula === cedula.trim()) return res.status(409).json({ success: false, message: 'La cédula ya está registrada.' });
      return res.status(409).json({ success: false, message: 'El correo ya está registrado.' });
    }

    // Validar cédula con el API externo del padrón electoral
    try {
      const apiBase = (process.env.CEDULA_API_URL || 'https://apis.gometa.org/cedulas').replace(/\/$/, '');
      const cedulaRes = await fetch(`${apiBase}/${cedula.trim()}`);
      if (!cedulaRes.ok) {
        return res.status(400).json({ success: false, message: 'La cédula no existe en el padrón electoral.' });
      }
      const cedulaData = await cedulaRes.json();
      if (!cedulaData.resultcount || cedulaData.resultcount === 0) {
        return res.status(400).json({ success: false, message: 'La cédula no existe en el padrón electoral.' });
      }
    } catch (cedulaErr) {
      console.error('No se pudo conectar al API de cédulas:', cedulaErr.message);
      return res.status(503).json({ success: false, message: 'Servicio de validación de cédulas no disponible.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generar token de activación
    const activationToken = generateToken(32);
    const activationHash  = hashToken(activationToken);
    const activationExp   = expiresInHours(ACTIVATION_TTL_HOURS);

    const user = new User({
      username:  username.trim(),
      password:  hashedPassword,
      nombre:    nombre.trim(),
      cedula:    cedula.trim(),
      email:     email.trim().toLowerCase(),
      telefono:  telefono.trim(),
      twoFactorEnabled: true,
      twoFactorPhone: normalizedPhone,
      estado:    'pendiente',
      emailVerificationTokenHash: activationHash,
      emailVerificationExpiresAt:  activationExp,
      emailVerificationLastSentAt: new Date(),
    });
    await user.save();

    // Enviar correo de activación (no bloquea si falla)
    const activationUrl = `${frontendUrl()}/pages/verificar-email.html?token=${activationToken}`;
    try {
      await sendActivationEmail({ to: user.email, nombre: user.nombre, activationUrl });
    } catch (mailErr) {
      console.error('[userRegister] Error enviando correo de activación:', mailErr.message);
    }

    return res.status(201).json({
      success: true,
      pendingActivation: true,
      message: 'Cuenta creada. Revisa tu correo para activarla.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ── Activar cuenta por token de correo ──────────────────────────────────────
const activateEmail = async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Token requerido.' });
  }
  try {
    const tokenHash = hashToken(token);
    const user = await User.findOne({ emailVerificationTokenHash: tokenHash });

    if (!user) {
      return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Enlace de activación inválido.' });
    }
    if (user.estado === 'activo') {
      return res.status(200).json({ success: true, alreadyActive: true, message: 'La cuenta ya está activa. Inicia sesión.' });
    }
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({ success: false, code: 'TOKEN_EXPIRED', message: 'El enlace expiró. Solicita uno nuevo.' });
    }

    user.estado = 'activo';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt  = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'Cuenta activada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('[activateEmail]', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ── Reenviar correo de activación ────────────────────────────────────────────
const resendActivationEmail = async (req, res) => {
  const { email } = req.body;
  if (!email || email.trim() === '') {
    return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
  }
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Respuesta genérica para no filtrar existencia de cuenta
    const genericOk = { success: true, message: 'Si ese correo está registrado y la cuenta está pendiente, recibirás un nuevo enlace.' };

    if (!user || user.estado === 'activo') {
      return res.status(200).json(genericOk);
    }

    // Cooldown: mínimo ACTIVATION_COOLDOWN_MS entre reenvíos
    if (user.emailVerificationLastSentAt) {
      const elapsed = Date.now() - user.emailVerificationLastSentAt.getTime();
      if (elapsed < ACTIVATION_COOLDOWN_MS) {
        const waitSec = Math.ceil((ACTIVATION_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ success: false, message: `Espera ${waitSec} segundos antes de solicitar otro correo.` });
      }
    }

    const activationToken = generateToken(32);
    const activationHash  = hashToken(activationToken);
    user.emailVerificationTokenHash = activationHash;
    user.emailVerificationExpiresAt  = expiresInHours(ACTIVATION_TTL_HOURS);
    user.emailVerificationLastSentAt = new Date();
    await user.save();

    const activationUrl = `${frontendUrl()}/pages/verificar-email.html?token=${activationToken}`;
    try {
      await sendActivationEmail({ to: user.email, nombre: user.nombre, activationUrl });
    } catch (mailErr) {
      console.error('[resendActivationEmail] Error enviando correo:', mailErr.message);
    }

    return res.status(200).json(genericOk);
  } catch (error) {
    console.error('[resendActivationEmail]', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ── Login: emite JWT directo o inicia flujo 2FA ──────────────────────────────
const userLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Correo y contraseña son obligatorios.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'Correo no encontrado.' });
    }

    if (user.estado !== 'activo') {
      return res.status(403).json({
        success: false,
        code: 'PENDING_ACTIVATION',
        message: 'Cuenta pendiente de activación. Revisa tu correo electrónico.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas.' });
    }

    // ── Requerir 2FA cuando exista teléfono válido ─────────────────────────
    const phone = user.twoFactorPhone || normalizeCRPhone(user.telefono);
    const shouldUseTwoFactor = Boolean(user.twoFactorEnabled || phone);
    if (shouldUseTwoFactor) {
      if (!phone) {
        return res.status(422).json({ success: false, message: 'Número de teléfono no configurado para 2FA.' });
      }

      if (!user.twoFactorEnabled || !user.twoFactorPhone) {
        user.twoFactorEnabled = true;
        user.twoFactorPhone = phone;
      }

      const otp            = generateOTP();
      const otpHash        = hashToken(otp);
      const pendingToken   = generateToken(32);
      const pendingHash    = hashToken(pendingToken);

      user.twoFactorCodeHash   = otpHash;
      user.twoFactorExpiresAt  = expiresInMinutes(MFA_TTL_MINUTES);
      user.twoFactorAttempts   = 0;
      user.twoFactorLastSentAt = new Date();
      user.pendingLoginTokenHash = pendingHash;
      user.pendingLoginExpiresAt = expiresInMinutes(PENDING_LOGIN_TTL_MIN);
      await user.save();

      try {
        await sendSMSCode({ to: phone, code: otp });
      } catch (smsErr) {
        console.error('[userLogin 2FA] Error enviando SMS:', smsErr.message);
        return res.status(502).json({
          success: false,
          code: 'SMS_SEND_FAILED',
          message: 'No se pudo enviar el código SMS. Verifica la configuración de Twilio e intenta de nuevo.',
        });
      }

      return res.status(202).json({
        success: true,
        requiresTwoFactor: true,
        pendingLoginToken: pendingToken,
        message: `Se envió un código de verificación a tu teléfono.`,
      });
    }

    // ── Sin 2FA: emitir JWT directo ──────────────────────────────────────────
    const secret = jwtSecret();
    const token = jwt.sign(
      { id: user._id, username: user.username },
      secret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null },
    });
  } catch (error) {
    console.error('[userLogin]', error);
    res.status(500).json({ success: false, errorName: error.name, errorMessage: error.message });
  }
};

// ── Verificar código 2FA y emitir JWT final ──────────────────────────────────
const verify2FA = async (req, res) => {
  const { pendingLoginToken, code } = req.body;
  if (!pendingLoginToken || !code) {
    return res.status(400).json({ success: false, message: 'Token temporal y código son obligatorios.' });
  }
  try {
    const pendingHash = hashToken(pendingLoginToken);
    const user = await User.findOne({ pendingLoginTokenHash: pendingHash });

    if (!user) {
      return res.status(400).json({ success: false, code: 'INVALID_SESSION', message: 'Sesión de verificación inválida o expirada.' });
    }
    if (user.pendingLoginExpiresAt < new Date()) {
      return res.status(400).json({ success: false, code: 'SESSION_EXPIRED', message: 'La sesión de verificación expiró. Inicia sesión nuevamente.' });
    }
    if (user.twoFactorExpiresAt < new Date()) {
      return res.status(400).json({ success: false, code: 'CODE_EXPIRED', message: 'El código expiró. Solicita uno nuevo.' });
    }
    if (user.twoFactorAttempts >= MFA_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Inicia sesión nuevamente.' });
    }

    const codeHash = hashToken(String(code).trim());
    if (codeHash !== user.twoFactorCodeHash) {
      user.twoFactorAttempts += 1;
      await user.save();
      const remaining = MFA_MAX_ATTEMPTS - user.twoFactorAttempts;
      return res.status(401).json({ success: false, message: `Código incorrecto. ${remaining > 0 ? `Intentos restantes: ${remaining}` : 'Sin más intentos.'}` });
    }

    // Código correcto: limpiar campos temporales y emitir JWT
    user.twoFactorCodeHash     = null;
    user.twoFactorExpiresAt    = null;
    user.twoFactorAttempts     = 0;
    user.pendingLoginTokenHash = null;
    user.pendingLoginExpiresAt = null;
    await user.save();

    const secret = jwtSecret();
    const token = jwt.sign(
      { id: user._id, username: user.username },
      secret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Verificación exitosa.',
      token,
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null },
    });
  } catch (error) {
    console.error('[verify2FA]', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ── Reenviar código SMS 2FA ───────────────────────────────────────────────────
const resend2FACode = async (req, res) => {
  const { pendingLoginToken } = req.body;
  if (!pendingLoginToken) {
    return res.status(400).json({ success: false, message: 'Token de sesión requerido.' });
  }
  try {
    const pendingHash = hashToken(pendingLoginToken);
    const user = await User.findOne({ pendingLoginTokenHash: pendingHash });

    if (!user || user.pendingLoginExpiresAt < new Date()) {
      return res.status(400).json({ success: false, code: 'INVALID_SESSION', message: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
    }

    // Cooldown
    if (user.twoFactorLastSentAt) {
      const elapsed = Date.now() - user.twoFactorLastSentAt.getTime();
      if (elapsed < MFA_COOLDOWN_MS) {
        const waitSec = Math.ceil((MFA_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ success: false, message: `Espera ${waitSec} segundos antes de solicitar otro código.` });
      }
    }

    const otp    = generateOTP();
    const phone  = user.twoFactorPhone || normalizeCRPhone(user.telefono);

    user.twoFactorCodeHash   = hashToken(otp);
    user.twoFactorExpiresAt  = expiresInMinutes(MFA_TTL_MINUTES);
    user.twoFactorAttempts   = 0;
    user.twoFactorLastSentAt = new Date();
    await user.save();

    try {
      await sendSMSCode({ to: phone, code: otp });
    } catch (smsErr) {
      console.error('[resend2FACode] Error enviando SMS:', smsErr.message);
      return res.status(502).json({
        success: false,
        code: 'SMS_SEND_FAILED',
        message: 'No se pudo reenviar el código SMS. Verifica Twilio e intenta de nuevo.',
      });
    }

    return res.status(200).json({ success: true, message: 'Nuevo código enviado a tu teléfono.' });
  } catch (error) {
    console.error('[resend2FACode]', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// ── Activar / desactivar 2FA para el usuario autenticado ────────────────────
const toggle2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false });

    const { enable, phone } = req.body;

    if (enable) {
      const normalized = normalizeCRPhone(phone || user.telefono);
      if (!normalized) {
        return res.status(400).json({ success: false, message: 'Número de teléfono inválido.' });
      }
      user.twoFactorEnabled = true;
      user.twoFactorPhone   = normalized;
    } else {
      user.twoFactorEnabled    = false;
      user.twoFactorPhone      = null;
      user.twoFactorCodeHash   = null;
      user.twoFactorExpiresAt  = null;
      user.twoFactorAttempts   = 0;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: enable ? '2FA activado correctamente.' : '2FA desactivado.',
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    console.error('[toggle2FA]', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// Perfil del usuario logueado (req.user viene del middleware protect)
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false });
    res.status(200).json({
      success: true,
      data: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

// Actualizar nombre y/o foto: multipart pone la imagen en req.file; si no, se puede mandar foto_perfil en el body
const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false });

    if (req.body.nombre !== undefined && String(req.body.nombre).trim()) {
      user.nombre = String(req.body.nombre).trim();
    }
    if (req.file && req.file.filename) {
      user.foto_perfil = '/uploads/profiles/' + req.file.filename;
    } else if (req.body.foto_perfil !== undefined) {
      user.foto_perfil = req.body.foto_perfil ? String(req.body.foto_perfil).trim() : null;
    }

    await user.save();
    res.status(200).json({
      success: true,
      data: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

module.exports = { userRegister, userLogin, getMe, updateMe, getCedulaInfo, activateEmail, resendActivationEmail, verify2FA, resend2FACode, toggle2FA };
