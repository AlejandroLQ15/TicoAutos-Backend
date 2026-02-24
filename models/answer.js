const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    texto_respuesta: { required: true, type: String }, 
    fecha_respuesta: { type: Date, default: Date.now }, 
    pregunta_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question' // Relación: Una respuesta pertenece a una pregunta 
    },
    usuario_responde_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    }
});

module.exports = mongoose.model('Answer', answerSchema);