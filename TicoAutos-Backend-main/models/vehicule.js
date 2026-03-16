const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    marca: { required: true, type: String },
    modelo: { required: true, type: String },
    anio: { required: true, type: Number },
    precio: { required: true, type: Number },
    estado: {
        type: String,
        enum: ['disponible', 'reservado', 'vendido'],
        default: 'disponible'
    },
    fotos: {
        type: [String],
        default: []
    },
    kilometraje: { type: Number, default: null },
    tipoCombustible: {
        type: String,
        enum: ['gasolina', 'diesel', 'hibrido', 'electrico'],
        default: null
    },
    tipoTransmision: {
        type: String,
        enum: ['automatico', 'manual'],
        default: null
    },
    provincia: {
        type: String,
        enum: ['Alajuela', 'Cartago', 'Guanacaste', 'Heredia', 'Limón', 'Puntarenas', 'San José'],
        default: null
    },
    owner_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);