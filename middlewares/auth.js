const jwt = require('jsonwebtoken');

// Protege rutas: exige header Authorization: Bearer <JWT> y deja req.user listo para los controladores.
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Necesitás iniciar sesión para continuar.' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = (process.env.JWT_SECRET || process.env.SECRET_KEY || 'ticoautos_secret_key_2026').trim();

  try {
    const decoded = jwt.verify(token, jwtSecret);
        // Mismo payload que emiten login, Google callback y verify-2FA (id + username).
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tu sesión expiró por seguridad. Iniciá sesión de nuevo para enviar mensajes o seguir navegando.',
      });
    }
    return res.status(401).json({ success: false, message: 'Sesión inválida. Iniciá sesión de nuevo.' });
  }
};

module.exports = { protect };