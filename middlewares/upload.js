// Subida de archivos con Multer: fotos de vehículos y foto de perfil (límites de tamaño y tipo).
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'vehicles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, unique + ext);
  }
});

const fileFilter = (req, file, cb) => {
    // Solo imágenes web habituales; evita subir ejecutables u otros tipos.
  const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP).'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Si el body es multipart, procesa hasta 10 fotos; si no, sigue sin tocar el body (JSON).
function optionalMulter(req, res, next) {
  const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
  if (!isMultipart) return next();
  upload.array('fotos', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}

const profileDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}
const storageProfile = multer.diskStorage({
  destination: (req, file, cb) => cb(null, profileDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, unique + ext);
  }
});
const uploadProfile = multer({ storage: storageProfile, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

// Igual que optionalMulter pero un solo archivo para el campo foto_perfil del perfil.
function optionalMulterProfile(req, res, next) {
  const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
  if (!isMultipart) return next();
  uploadProfile.single('foto_perfil')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}

module.exports = { upload, optionalMulter, optionalMulterProfile, uploadProfile };