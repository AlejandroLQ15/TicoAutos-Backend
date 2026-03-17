const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { answerPost, answerGetByQuestion } = require('../controllers/answer');

// POST /api/answers (protected) - only vehicle owner can answer
router.post('/', protect, answerPost);

// GET /api/answers/question/:preguntaId (protected - solo dueño o quien preguntó)
router.get('/question/:preguntaId', protect, answerGetByQuestion);

module.exports = router;