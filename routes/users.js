const express = require('express');
const router = express.Router();
const User = require('../models/user');

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, nombre } = req.body;
    if (!username || username.trim() === '') {
      return res.sendStatus(400);
    }
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.sendStatus(409);
    }
    const user = new User({ username, password, nombre });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.sendStatus(409);
    }
    res.sendStatus(400);
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.sendStatus(404);
    }
    if (user.password !== password) {
      return res.sendStatus(401);
    }
    res.status(200).json(user);
  } catch (error) {
    res.sendStatus(500);
  }
});

module.exports = router;
