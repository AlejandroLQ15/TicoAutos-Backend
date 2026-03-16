const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    texto_respuesta: { required: true, type: String, trim: true },
    fecha_respuesta: { type: Date, default: Date.now },
    pregunta_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        unique: true
    },
    vehiculo_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
    },
    usuario_pregunta_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    usuario_responde_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Answer', answerSchema);