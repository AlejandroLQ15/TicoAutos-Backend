// server/index.js
const mongoose = require('mongoose');

// Aquí se define la URL y el nombre de la base de datos
mongoose.connect('mongodb://127.0.0.1:27017/ticoautos'); 

const database = mongoose.connection;

// Manejo de errores de conexión
database.on('error', (error) => { 
    console.log(error); 
});

// Confirmación de conexión exitosa
database.once('connected', () => {
    console.log('Database Connected');
});