const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    pregunta: { required: true, type: String, trim: true, immutable: true },
    fecha_pregunta: { type: Date, default: Date.now, immutable: true },
    vehiculo_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        immutable: true
    },
    usuario_pregunta_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        immutable: true
    },
    usuario_duenio_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        immutable: true
    }
});

module.exports = mongoose.model('Question', questionSchema);