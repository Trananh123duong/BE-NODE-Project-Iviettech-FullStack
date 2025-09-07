const express = require('express')
const router = express.Router()

const followController = require('../../controllers/user/follow.controller')

const { verifyToken } = require('../../middleware/auth')

router.get('/', verifyToken, followController.listMyFollowedStories)

module.exports = router