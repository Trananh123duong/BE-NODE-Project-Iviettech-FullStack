const jwt = require('jsonwebtoken')
const { users: User } = require('../models')

function computeIsVip(user) {
  return !!user?.vip_expires_at && new Date(user.vip_expires_at) > new Date()
}

/**
 * Đọc token -> verify -> load user -> auto-clear VIP nếu đã hết hạn -> trả user "an toàn"
 * Trả về: { id, email, role, vip_started_at, vip_expires_at, isVip } | null
 */
async function decodeToken(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return null

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_KEY)
  } catch {
    return null
  }

  const user = await User.findByPk(decoded.id, {
    attributes: ['id', 'email', 'role', 'vip_started_at', 'vip_expires_at']
  })
  if (!user) return null

  // Lazy-expire VIP: nếu đã hết hạn thì bỏ ngay
  if (user.vip_expires_at && new Date(user.vip_expires_at) <= new Date()) {
    await user.update({ vip_started_at: null, vip_expires_at: null })
  }

  const isVip = computeIsVip(user)
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    vip_started_at: user.vip_started_at,
    vip_expires_at: user.vip_expires_at,
    isVip,
  }
}

const verifyToken = async (req, res, next) => {
  const decoded = await decodeToken(req)
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or missing token' })
  }
  req.user = decoded
  next()
}

const optionalAuth = async (req, res, next) => {
  req.user = await decodeToken(req)
  next()
}

const checkAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next()
  return res.status(403).json({ message: 'Forbidden' })
}

module.exports = { verifyToken, optionalAuth, checkAdmin }
