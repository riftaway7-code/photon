const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || '2defc66af782866835a21184930164f63290957d5291280d14cf4ca4b25e76a3';

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { auth, SECRET };
