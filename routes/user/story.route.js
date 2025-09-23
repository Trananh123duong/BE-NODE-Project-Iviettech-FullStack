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

// upsert chấm sao (1..5)
router.post('/:id/rating', verifyToken, storyController.rateStory)
// tổng quan rating (avg, count, phân phối 1..5)
router.get('/:id/ratings/summary', storyController.getRatingSummary)
// bình luận theo truyện (gom tất cả chapter; public/optionalAuth)
router.get('/:id/comments', optionalAuth, storyController.getStoryComments)

module.exports = router