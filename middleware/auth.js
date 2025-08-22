const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
  // Authorization: Bearer <token> -> ['Bearer', '<token>']
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    // { id, email }
    const decoded = jwt.verify(token, process.env.JWT_KEY)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

const checkAdmin = (req, res, next) => {
  console.log(req.user)
  const userRole = req.user.role

  if (userRole === 'admin') {
    next()
  } else {
    return res.status(403).json({ message: 'Forbidden' })
  }
}

module.exports = { verifyToken, checkAdmin }