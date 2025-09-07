const express = require('express')
const router = express.Router()

const storyController = require('../../controllers/user/story.controller')
const chapterController = require('../../controllers/user/chapter.controller')
const followCtrl = require('../../controllers/user/follow.controller')

const { optionalAuth, verifyToken } = require('../../middleware/auth')

router.get('/', storyController.getStoryList)
router.get('/:id', optionalAuth, storyController.getStoryDetail)

router.get('/:storyId/chapters', optionalAuth, chapterController.getChaptersByStory)

router.post('/:storyId/follow', verifyToken, followCtrl.followStory)
router.delete('/:storyId/follow', verifyToken, followCtrl.unfollowStory)

module.exports = router