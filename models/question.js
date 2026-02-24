JavaScript
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    pregunta: { required: true, type: String },
    fecha_pregunta: { type: Date, default: Date.now },
    vehiculo_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
    },
    usuario_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    respuesta: { type: String }, 
    fecha_respuesta: { type: Date } 
});

module.exports = mongoose.model('Question', questionSchema);