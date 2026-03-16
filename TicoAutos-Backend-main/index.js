// server/index.js
require('dotenv').config();
const path = require('path');
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
  'http://localhost:5173',
  'http://localhost:5500',
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'null' // cuando abres el HTML por file://
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // En desarrollo: permitir cualquier localhost / 127.0.0.1
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
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