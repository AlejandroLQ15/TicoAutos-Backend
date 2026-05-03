const mongoose = require('mongoose');

// Usuario de la plataforma: registro clásico o Google, estado de cuenta, correo, 2FA por SMS, etc.
const userSchema = new mongoose.Schema({
    username:   { type: String, unique: true, sparse: true },
    password:   { type: String },
    nombre:     { required: true, type: String },
    cedula:     { type: String, unique: true, sparse: true },
    /** Fecha de nacimiento civil YYYY-MM-DD (padrón o declarada). */
    fechaNacimiento: { type: String, default: null },
    /** Origen de fechaNacimiento para trazabilidad (omitido en usuarios legacy). */
    birthDateSource: { type: String, enum: ['padron', 'declarada'] },
    email:      { type: String, unique: true, sparse: true },
    telefono:   { type: String },
    estado:     { type: String, enum: ['pendiente', 'activo'], default: 'activo' },
    googleId:   { type: String, unique: true, sparse: true },
    foto_perfil: { type: String, default: null },

    // ── Verificación de correo electrónico ──────────────────────────────────
    emailVerificationTokenHash: { type: String, default: null },
    emailVerificationExpiresAt:  { type: Date,   default: null },
    emailVerificationLastSentAt: { type: Date,   default: null },

    // ── Autenticación de Dos Factores (2FA) opcional por usuario ────────────
    twoFactorEnabled:    { type: Boolean, default: false },
    twoFactorPhone:      { type: String,  default: null },   // E.164 normalizado
    twoFactorCodeHash:   { type: String,  default: null },
    twoFactorExpiresAt:  { type: Date,    default: null },
    twoFactorAttempts:   { type: Number,  default: 0 },
    twoFactorLastSentAt: { type: Date,    default: null },

    // ── Token de login pendiente (pre-JWT, solo durante flujo 2FA) ──────────
    pendingLoginTokenHash: { type: String, default: null },
    pendingLoginExpiresAt: { type: Date,   default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
