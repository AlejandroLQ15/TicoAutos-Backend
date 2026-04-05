const User = require('../models/users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

// Registro: crea cuenta; la contraseña nunca se guarda en texto plano
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

    const user = new User({
      username: username.trim(),
      password: hashedPassword,
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono.trim(),
      estado: 'activo' // TODO: cambiar a 'pendiente' cuando se implemente verificación por correo
    });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente.',
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

// Login: si la contraseña cuadra, devuelve un token JWT (24h) para usar en rutas protegidas
const userLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username y password son obligatorios.' });
    }

    const user = await User.findOne({ username });
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.estado !== 'activo') {
      return res.status(403).json({ success: false, message: 'Cuenta pendiente de activación. Revisa tu correo electrónico.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas.' });
    }

    // Debe ser la misma clave que usa middlewares/auth.js al verificar el token
    const secret = (process.env.JWT_SECRET || process.env.SECRET_KEY || 'ticoautos_secret_key_2026').trim();
    console.log('Verificando JWT_SECRET en ejecucion:', secret ? 'RECIBIDO' : 'VACIO');

    const token = jwt.sign(
      { id: user._id, username: user.username },
      secret,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      errorName: error.name,
      errorMessage: error.message
    });
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

module.exports = { userRegister, userLogin, getMe, updateMe, getCedulaInfo };
