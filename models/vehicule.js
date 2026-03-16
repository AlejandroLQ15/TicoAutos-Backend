const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    marca: { required: true, type: String },  
    modelo: { required: true, type: String },    
    anio: { required: true, type: Number },      
    precio: { required: true, type: Number },    
    estado: { 
        type: String, 
        enum: ['disponible', 'vendido'], 
        default: 'disponible' 
    }, 
    owner_id: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);