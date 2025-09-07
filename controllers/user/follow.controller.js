const asyncHandler = require('express-async-handler')
const { Op } = require('sequelize')
const { NotFoundError } = require('../../utils/ApiError')
const { user_follows: UserFollow, stories: Story, chapters: Chapter } = require('../../models')

const listMyFollowedStories = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { page = 1, limit = 10 } = req.query
  const offset = (Number(page) - 1) * Number(limit)

  const chapterInclude = {
    model: Chapter,
    as: 'chapters',
    order: [['id', 'DESC']],
    limit: 3,
    separate: true,
    required: false,
  }

  const result = await Story.findAndCountAll({
    include: [
      {
        model: UserFollow,
        as: 'user_follows',
        attributes: ['created_at'],
        where: { user_id: userId },
        required: true,
      },
      chapterInclude,
    ],
    order: [[{ model: UserFollow, as: 'user_follows' }, 'created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    distinct: true,
    subQuery: false,
  })

  const totalPages = Math.ceil(result.count / parseInt(limit, 10))

  return res.status(200).json({
    data: result.rows,
    meta: {
      total: result.count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages,
    },
  })
})

const followStory = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { storyId } = req.params

  const story = await Story.findByPk(storyId, { attributes: ['id'] })
  if (!story) throw new NotFoundError('Không tìm thấy truyện')

  const [row, created] = await UserFollow.findOrCreate({
    where: { user_id: userId, story_id: storyId },
    defaults: { user_id: userId, story_id: storyId },
  })

  if (created) {
    await Story.increment('total_follow', { by: 1, where: { id: storyId } })
  }

  return res.status(200).json({
    is_followed: true,
    message: created ? 'Đã theo dõi truyện' : 'Đã theo dõi trước đó',
  })
})

const unfollowStory = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { storyId } = req.params

  const story = await Story.findByPk(storyId, { attributes: ['id'] })
  if (!story) throw new NotFoundError('Không tìm thấy truyện')

  const deleted = await UserFollow.destroy({
    where: { user_id: userId, story_id: storyId },
  })

  if (deleted) {
    await Story.decrement('total_follow', {
      by: 1,
      where: { id: storyId, total_follow: { [Op.gt]: 0 } },
    })
  }

  return res.status(200).json({
    is_followed: false,
    message: deleted ? 'Đã bỏ theo dõi' : 'Bạn chưa theo dõi truyện này',
  })
})

module.exports = { listMyFollowedStories, followStory, unfollowStory }
