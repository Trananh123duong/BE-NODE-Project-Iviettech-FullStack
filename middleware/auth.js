const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
  const decoded = decodeToken(req)
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or missing token' })
  }
  req.user = decoded
  next()
}

const optionalAuth = (req, res, next) => {
  req.user = decodeToken(req)
  next()
}

function decodeToken(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return null

  try {
    return jwt.verify(token, process.env.JWT_KEY)
  } catch (error) {
    return null
  }
}

const checkAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next()
  }
  return res.status(403).json({ message: 'Forbidden' })
}

module.exports = { verifyToken, optionalAuth, checkAdmin }
