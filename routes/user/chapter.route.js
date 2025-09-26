const router = require('express').Router()

const chapterController = require('../../controllers/user/chapter.controller')
const { optionalAuth, verifyToken } = require('../../middleware/auth')

router.get('/:id', optionalAuth, chapterController.getChapterDetail)

// danh sách bình luận của 1 chapter (có phân trang)
router.get('/:id/comments', optionalAuth, chapterController.getChapterComments)
// tạo bình luận (comment gốc hoặc reply: body, parent_id?)
router.post('/:id/comments', verifyToken, chapterController.createChapterComment)
// xoá mềm bình luận (chủ cmt hoặc admin)
router.delete('/comments/:id', verifyToken, chapterController.deleteComment)
// like / bỏ like bình luận
router.post('/comments/:id/like', verifyToken, chapterController.likeComment)
router.delete('/comments/:id/like', verifyToken, chapterController.unlikeComment)

module.exports = router