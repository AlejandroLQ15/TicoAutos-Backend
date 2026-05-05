const crypto = require('crypto');

/**
 * Genera un token aleatorio seguro en formato hex.
 * @param {number} bytes - Número de bytes de entropía (default 32 → 64 chars hex)
 * @returns {string}
 */
const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Genera un código OTP numérico de 6 dígitos.
 * @returns {string}
 */
const generateOTP = () => {
  // randomInt(min, max) es criptográficamente seguro en Node ≥ 14.10
  const n = crypto.randomInt(100000, 1000000);
  return String(n);
};

/**
 * Hashea un token o código OTP con SHA-256 para almacenamiento seguro.
 * @param {string} token
 * @returns {string} hex SHA-256
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

/**
 * Devuelve una Date de expiración a N minutos desde ahora.
 * @param {number} minutes
 * @returns {Date}
 */
const expiresInMinutes = (minutes) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Devuelve una Date de expiración a N horas desde ahora.
 * @param {number} hours
 * @returns {Date}
 */
const expiresInHours = (hours) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

/**
 * Normaliza un número de teléfono a formato E.164 para Costa Rica (+506).
 * Acepta: 8 dígitos, "506XXXXXXXX", "+506XXXXXXXX".
 * @param {string} phone
 * @returns {string|null} E.164 o null si no es un formato reconocido
 */
const normalizeCRPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^506\d{8}$/.test(digits)) return '+' + digits;
  if (/^\d{8}$/.test(digits)) return '+506' + digits;
  if (/^\+506\d{8}$/.test(phone.replace(/\s/g, ''))) return phone.replace(/\s/g, '');
  // Número internacional que ya incluye código de país
  if (digits.length > 8) return '+' + digits;
  return null;
};

/**
 * Duración del JWT de sesión (jsonwebtoken `expiresIn`, ej. 24h, 7d, 30d).
 * @returns {string}
 */
const jwtExpiresIn = () => {
  const raw = (process.env.JWT_EXPIRES_IN || '7d').trim();
  return raw || '7d';
};

module.exports = {
  generateToken,
  generateOTP,
  hashToken,
  expiresInMinutes,
  expiresInHours,
  normalizeCRPhone,
  jwtExpiresIn,
};