const router = require('express').Router()

const chapterController = require('../../controllers/user/chapter.controller')
const { optionalAuth  } = require('../../middleware/auth')

router.get('/:id', optionalAuth, chapterController.getChapterDetail)

module.exports = router