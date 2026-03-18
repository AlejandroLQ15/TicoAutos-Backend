// server/index.js
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');

//Here you define the URL and the database name
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticoautos';
mongoose.connect(mongoURI);

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

// Enable CORS for frontend (desarrollo + producción con dominio personalizado)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5500',
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'null'
];
// Dominios de producción: define ALLOWED_ORIGINS en .env (ej: https://ticoautos.com,https://www.ticoautos.com)
const extraOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (extraOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true
}));

// preflight handled by CORS middleware applied globally

// No parsear JSON en peticiones multipart para que multer reciba el body intacto (múltiples fotos)
app.use((req, res, next) => {
  const ct = (req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) return next();
  express.json()(req, res, next);
});

// Archivos subidos (fotos de vehículos y perfiles)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import and mount user routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Import and mount autos routes
const autosRoutes = require('./routes/autos');
app.use('/api/autos', autosRoutes);

// Import and mount vehicles public route alias
const vehiclesRoutes = require('./routes/vehicles');
app.use('/api/vehicles', vehiclesRoutes);

// Import and mount inbox routes
const questionsRoutes = require('./routes/questions');
app.use('/api/questions', questionsRoutes);

const answersRoutes = require('./routes/answers');
app.use('/api/answers', answersRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});