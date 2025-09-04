const express = require('express');
const router = express.Router()

const authController = require('../controllers/auth.controller')
const { verifyToken  } = require('../middleware/auth')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/my-profile', verifyToken , authController.getMyProfile)
router.get('/refresh', verifyToken, authController.refreshAccessToken)

module.exports = router