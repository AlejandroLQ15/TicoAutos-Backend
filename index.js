// server/index.js
require('dotenv').config();
const mongoose = require('mongoose');

//Here you define the URL and the database name
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticoautos'); 

const database = mongoose.connection;

// Connection error handling //Manejo
database.on('error', (error) => { 
    console.log(error); 
});

// Confirmation of successful connection
database.once('connected', () => {
    console.log('Database Connected');
});
// Express setup
const express = require('express');// Importa el framework para crear el servidor.
const cors = require('cors');// Importa el middleware de seguridad CORS.
const app = express();// Inicializa la aplicación Express.

// Enable CORS for frontend communication (allow dev origins)
const allowedOrigins = [
  'http://localhost:5173', // Vite / React dev
  'http://127.0.0.1:5500',  // Live Server / static HTML
  'http://localhost:3001'   // alternative frontend port
];

app.use(cors({
  origin: function(origin, callback) {// Permite peticiones que no vienen de un navegador
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true
}));

// preflight handled by CORS middleware applied globally

app.use(express.json());

// Import and mount user routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Import and mount autos routes
const autosRoutes = require('./routes/autos');
app.use('/api/autos', autosRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});