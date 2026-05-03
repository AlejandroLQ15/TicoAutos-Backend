// OAuth2 con Google: Passport redirige a Google y al volver crea o enlaza el usuario en MongoDB.
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const { fetchPadronByCedula } = require('../services/cedula/padronClient');
const { resolveBirthDateForRegistration, assertMeetsMinimumAge } = require('../utils/agePolicy');
const { normalizeCRPhone } = require('../utils/security/tokens');

// ─── Passport Google Strategy ────────────────────────────────────────────────
// Solo se inicializa si las credenciales de Google están configuradas en .env
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // 1. Usuario ya registrado con este googleId
      let user = await User.findOne({ googleId: profile.id });
      if (user) return done(null, { user, isNew: false });

      // 2. Usuario existente con el mismo correo → vincular cuenta
      const email = profile.emails?.[0]?.value;
      if (email) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          user.googleId = profile.id;
          await user.save();
          return done(null, { user, isNew: false });
        }
      }

      // 3. Usuario nuevo → redirige al frontend para completar registro con cédula
      const googleName = [profile.name?.givenName, profile.name?.familyName]
        .filter(Boolean).join(' ');
      return done(null, { isNew: true, googleId: profile.id, email: email || '', googleName });
    } catch (err) {
      return done(err);
    }
  }));
} else {
  console.warn('[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados. El login con Google no estará disponible.');
}

// Serialización mínima para el flujo OAuth (no se usa para sesiones persistentes)
passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateToken = (user) => {
  const secret = (process.env.JWT_SECRET || process.env.SECRET_KEY || 'ticoautos_secret_key_2026').trim();
  return jwt.sign(
    { id: user._id, username: user.username || user.email },
    secret,
    { expiresIn: '24h' }
  );
};

const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://127.0.0.1:5500').replace(/\/$/, '');

// ─── Controllers ─────────────────────────────────────────────────────────────

// GET /api/auth/google — inicia el flujo OAuth (requiere credenciales configuradas)
const googleAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ success: false, message: 'Login con Google no configurado en el servidor.' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

// GET /api/auth/google/callback — Google redirige aquí
const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, data) => {
    if (err || !data) {
      return res.redirect(`${frontendUrl()}/pages/login.html?error=google_auth_failed`);
    }

    if (!data.isNew) {
      // Usuario existente → generar token y redirigir al frontend
      const token = generateToken(data.user);
      const userJson = encodeURIComponent(JSON.stringify({
        id: data.user._id,
        username: data.user.username,
        nombre:   data.user.nombre,
        foto_perfil: data.user.foto_perfil || null
      }));
      return res.redirect(
        `${frontendUrl()}/pages/login.html?token=${token}&user=${userJson}`
      );
    }

    // Usuario nuevo → redirigir a registro con datos de Google
    const params = new URLSearchParams({
      google:     'true',
      googleId:   data.googleId,
      email:      data.email,
      googleName: data.googleName
    });
    return res.redirect(`${frontendUrl()}/pages/registro.html?${params.toString()}`);
  })(req, res, next);
};

// POST /api/auth/google/register — completa el registro de un usuario de Google
const googleRegister = async (req, res) => {
  try {
    const { googleId, email, nombre, cedula, telefono } = req.body;

    if (!googleId || !email || !nombre || !cedula || !telefono) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
    }
    if (!/^\d{9}$/.test(cedula.trim())) {
      return res.status(400).json({ success: false, message: 'Formato de cédula inválido. Debe tener 9 dígitos.' });
    }

    // Verificar duplicados
    const existing = await User.findOne({
      $or: [{ googleId }, { cedula: cedula.trim() }, { email: email.trim().toLowerCase() }]
    });
    if (existing) {
      if (existing.googleId === googleId)
        return res.status(409).json({ success: false, message: 'Esta cuenta de Google ya está registrada.' });
      if (existing.cedula === cedula.trim())
        return res.status(409).json({ success: false, message: 'La cédula ya está registrada.' });
      return res.status(409).json({ success: false, message: 'El correo ya está registrado.' });
    }

    const padron = await fetchPadronByCedula(cedula.trim());
    if (padron.error || padron.status >= 500) {
      console.error('[googleRegister] API cédulas:', padron.error || padron.status);
      return res.status(503).json({ success: false, message: 'Servicio de validación de cédulas no disponible.' });
    }
    if (!padron.data || !padron.data.resultcount || padron.data.resultcount === 0) {
      return res.status(400).json({ success: false, message: 'La cédula no existe en el padrón electoral.' });
    }

    const birthResolution = resolveBirthDateForRegistration({
      padronJson: padron.data,
      declaredDate: req.body.fechaNacimiento,
      declaracionAceptada: req.body.declaracionFechaNacimiento,
    });
    if (!birthResolution.ok) {
      return res.status(400).json({
        success: false,
        code: birthResolution.code,
        message: birthResolution.message,
      });
    }
    const ageGate = assertMeetsMinimumAge(birthResolution.birthIso);
    if (!ageGate.ok) {
      return res.status(400).json({ success: false, code: ageGate.code, message: ageGate.message });
    }

    const normalizedPhone = normalizeCRPhone(telefono.trim());
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'El teléfono debe ser válido (ejemplo: 88001234 o +50688001234).' });
    }

    // Los usuarios de Google están activos inmediatamente (Google ya verificó su correo)
    const user = new User({
      nombre:   nombre.trim(),
      cedula:   cedula.trim(),
      fechaNacimiento: birthResolution.birthIso,
      birthDateSource: birthResolution.source,
      email:    email.trim().toLowerCase(),
      telefono: telefono.trim(),
      twoFactorEnabled: true,
      twoFactorPhone: normalizedPhone,
      googleId,
      estado:   'activo'
    });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, nombre: user.nombre, email: user.email, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

module.exports = { googleAuth, googleCallback, googleRegister };
