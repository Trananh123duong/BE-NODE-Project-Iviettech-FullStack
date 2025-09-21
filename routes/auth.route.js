const express = require('express');
const router = express.Router()

const authController = require('../controllers/auth.controller')
const { verifyToken } = require('../middleware/auth')
const { avatarUploads } = require('../middleware/upload')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/my-profile', verifyToken , authController.getMyProfile)
router.get('/refresh', verifyToken, authController.refreshAccessToken)
router.patch('/my-profile', verifyToken, authController.updateProfile)
router.post(
  '/upload-avatar',
  verifyToken,
  avatarUploads.single('avatar'),
  authController.uploadAvatar
)

module.exports = router