const asyncHandler = require('express-async-handler')
const { Op, literal } = require('sequelize')
const { BadRequestError } = require('../../utils/ApiError') // nếu bạn có
const {
  reading_history: ReadingHistory,
  stories: Story,
  chapters: Chapter,
} = require('../../models')

const listMyHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { page = 1, limit = 10, keyword } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const storyInclude = {
    model: Story,
    as: 'story',
    attributes: ['id', 'name', 'thumbnail', 'author', 'status', 'total_view', 'total_follow', 'updated_at'],
    required: true,
  }

  if (keyword) {
    storyInclude.where = { name: { [Op.like]: `%${keyword}%` } }
  }

  const result = await ReadingHistory.findAndCountAll({
    where: { user_id: userId },
    attributes: ['id', 'user_id', 'story_id', 'chapter_id', 'last_read_at'],
    include: [
      {
        model: Story,
        as: 'story',
        attributes: ['id', 'name', 'thumbnail', 'author', 'status', 'total_view', 'total_follow', 'updated_at'],
        required: true,
      },
      {
        model: Chapter,
        as: 'chapter',
        attributes: ['id', 'chapter_number', 'title'],
        required: false,
      },
    ],
    order: [['last_read_at', 'DESC'], ['story', 'updated_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  })

  const totalPages = Math.ceil(result.count / parseInt(limit, 10))

  res.status(200).json({
    data: result.rows,
    meta: {
      total: result.count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages,
    },
  })
})

const deleteMyHistoryItem = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { id } = req.params

  const deleted = await ReadingHistory.destroy({
    where: { id, user_id: userId },
  })

  return res.status(200).json({
    message: deleted ? 'Đã xoá lịch sử truyện' : 'Không tìm thấy trong lịch sử',
  })
})

module.exports = {
  listMyHistory,
  deleteMyHistoryItem,
}
