const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { required: true, type: String, unique: true },
    password: { required: true, type: String },
    nombre: { required: true, type: String },
    foto_perfil: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);    