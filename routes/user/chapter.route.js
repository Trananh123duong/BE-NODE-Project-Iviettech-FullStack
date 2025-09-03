const router = require('express').Router()

const chapterController = require('../../controllers/user/chapter.controller')

router.get('/:id', chapterController.getChapterDetail)

module.exports = router