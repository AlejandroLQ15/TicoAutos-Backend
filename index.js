// Punto de entrada del backend TicoAutos: API REST, MongoDB, CORS, OAuth Google y rutas.
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
// Carga la estrategia de Google (Passport); sin esto no habría login/registro OAuth.
require('./controllers/auth'); // registra la estrategia de Google en passport

//Definicion de URL y nombre de la base de datos MongoDB, con soporte para variables de entorno (desarrollo y producción).
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticoautos';
mongoose.connect(mongoURI);

const database = mongoose.connection;

// Manejo de errores de conexión
database.on('error', (error) => { 
    console.log(error); 
});

// Confirmación de conexión exitosa
database.once('connected', () => {
    console.log('Database Connected');
});

// Express instalación y configuración, incluyendo CORS personalizado para desarrollo y producción, sesiones para OAuth y rutas para autenticación, usuarios, autos y preguntas/respuestas.
const express = require('express');// Importa el framework para crear el servidor.
const cors = require('cors');// Importa el middleware de seguridad CORS.
const app = express();// Inicializa la aplicación Express.

// Habilita CORS con una función personalizada para permitir solo orígenes específicos en desarrollo y producción, incluyendo localhost, dominios definidos en .env y previews de Vercel. Esto protege la API de accesos no autorizados desde otros orígenes.
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
const allowAllOrigins = (process.env.CORS_ALLOW_ALL || '').toLowerCase() === 'true';

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowAllOrigins) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (extraOrigins.includes(origin)) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  // Permite previews y producción en Vercel sin actualizar código en cada deploy.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
};

app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Sesión: solo se usa transitoriamente durante el flujo OAuth (no para autenticación JWT)
app.use(session({
  secret: process.env.SESSION_SECRET || 'ticoautos_session_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 5 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// No parsear JSON en peticiones multipart para que multer reciba el body intacto (múltiples fotos)
app.use((req, res, next) => {
  const ct = (req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) return next();
  express.json()(req, res, next);
});

// Archivos subidos (fotos de vehículos y perfiles)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importa y monta rutas de autenticación, permitiendo a los usuarios registrarse e iniciar sesión con Google OAuth, lo que es fundamental para la experiencia de usuario en TicoAutos al facilitar el acceso sin necesidad de crear una cuenta tradicional.
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Importa y monta rutas de usuarios, permitiendo a los usuarios gestionar su perfil, lo que es esencial para la experiencia personalizada en TicoAutos.
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Importa y monta rutas de autos, permitiendo a los usuarios listar, crear, actualizar y eliminar autos en la plataforma, lo que es esencial para el funcionamiento principal de TicoAutos como marketplace de autos usados.
const autosRoutes = require('./routes/autos');
app.use('/api/autos', autosRoutes);

// Importa y monta rutas de vehículos, permitiendo a los usuarios listar, crear, actualizar y eliminar vehículos en la plataforma, lo que es esencial para el funcionamiento principal de TicoAutos como marketplace de autos usados.
const vehiclesRoutes = require('./routes/vehicles');
app.use('/api/vehicles', vehiclesRoutes);

// Importa y monta rutas de preguntas y respuestas, permitiendo a los usuarios interactuar con preguntas sobre vehículos, lo que fomenta la comunidad y el intercambio de información entre compradores y vendedores.
const questionsRoutes = require('./routes/questions');
app.use('/api/questions', questionsRoutes);

const answersRoutes = require('./routes/answers');
app.use('/api/answers', answersRoutes);

// Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const jwtSecret = (process.env.JWT_SECRET || process.env.SECRET_KEY || '').trim();
  console.log(`Server running on port ${PORT}`);
  console.log('JWT_SECRET presente:', !!jwtSecret);
  console.log('MONGODB_URI presente:', !!process.env.MONGODB_URI);
});