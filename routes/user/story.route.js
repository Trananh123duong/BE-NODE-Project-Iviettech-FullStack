const express = require('express')
const router = express.Router()

const storyController = require('../../controllers/user/story.controller')

// Category
router.get('/', storyController.getStoryList)

module.exports = router