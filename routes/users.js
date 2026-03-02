const express = require('express');
const router = express.Router();
const { userRegister, userLogin } = require('../controllers/user');

// POST /api/users/register
router.post('/register', userRegister);

// POST /api/users/login
router.post('/login', userLogin);

module.exports = router;
