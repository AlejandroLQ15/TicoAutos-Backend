const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username:   { type: String, unique: true, sparse: true },
    password:   { type: String },
    nombre:     { required: true, type: String },
    cedula:     { type: String, unique: true, sparse: true },
    email:      { type: String, unique: true, sparse: true },
    telefono:   { type: String },
    estado:     { type: String, enum: ['pendiente', 'activo'], default: 'activo' },
    googleId:   { type: String, unique: true, sparse: true },
    foto_perfil: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
