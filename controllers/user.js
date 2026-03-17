const User = require('../models/users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const userRegister = async (req, res) => {
  try {
    const { username, password, nombre } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ success: false });
    }
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ success: false });
    }
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ success: false });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ success: false });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({ username, password: hashedPassword, nombre });
    await user.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false });
  }
};

const userLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false });
    }
    
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false });
    res.status(200).json({
      success: true,
      data: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false });

    if (req.body.nombre !== undefined && String(req.body.nombre).trim()) {
      user.nombre = String(req.body.nombre).trim();
    }
    if (req.file && req.file.filename) {
      user.foto_perfil = '/uploads/profiles/' + req.file.filename;
    } else if (req.body.foto_perfil !== undefined) {
      user.foto_perfil = req.body.foto_perfil ? String(req.body.foto_perfil).trim() : null;
    }

    await user.save();
    res.status(200).json({
      success: true,
      data: { id: user._id, username: user.username, nombre: user.nombre, foto_perfil: user.foto_perfil || null }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

module.exports = { userRegister, userLogin, getMe, updateMe };