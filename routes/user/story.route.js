const express = require('express')
const router = express.Router()

const storyController = require('../../controllers/user/story.controller')
const chapterController = require('../../controllers/user/chapter.controller')
const { optionalAuth  } = require('../../middleware/auth')

// Category
router.get('/', storyController.getStoryList)
router.get('/:id', storyController.getStoryDetail)

router.get('/:storyId/chapters', optionalAuth, chapterController.getChaptersByStory)

module.exports = router