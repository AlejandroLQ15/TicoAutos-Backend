const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = (process.env.JWT_SECRET || process.env.SECRET_KEY || '').trim();

  if (!jwtSecret) {
    return res.status(500).json({ success: false, message: 'Server auth is not configured.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = { protect };
