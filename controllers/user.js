const User = require('../models/users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const userRegister = async (req, res) => {
  try {
    const { username, password, nombre } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({ username, password: hashedPassword, nombre });
    await user.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      user: { id: user._id, username: user.username, nombre: user.nombre }
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: 'Error registering user' });
  }
};

const userLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
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
      user: { id: user._id, username: user.username, nombre: user.nombre }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { userRegister, userLogin };