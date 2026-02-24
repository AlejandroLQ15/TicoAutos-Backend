const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { required: true, type: String, unique: true },
    password: { required: true, type: String }, // Por ahora texto plano, luego JWT
    nombre: { required: true, type: String }
});

module.exports = mongoose.model('User', userSchema);