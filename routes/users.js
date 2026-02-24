const express = require('express');
const router = express.Router();
const User = require('../models/users');

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const userData = req.body;
    const user = new User(userData);
    await user.save();
    res.status(201).json;
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json;
    }
    if (user.password !== password) {
      return res.status(401).json;
    }
    res.status(200).json;
  } catch (error) {
    res.status(500).json;
  }
});

module.exports = router;
