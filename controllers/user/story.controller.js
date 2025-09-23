// controllers/story.controller.js
const { fn, col, literal, Op, Transaction } = require('sequelize')
const asyncHandler = require('express-async-handler')
const { NotFoundError } = require('../../utils/ApiError')

const {
  stories: Story,
  categories: Category,
  chapters: Chapter,
  user_follows: UserFollow,
  story_ratings: StoryRating,
  story_comments: StoryComment,
  comment_likes: CommentLike,
  users: User,
} = require('../../models')

const getStoryList = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sort = 'id',
    order = 'desc',
    keyword,
    status
  } = req.query
  const categoryIds = req.query['categoryIds[]']
  const offset = (page - 1) * limit

  let whereClause = {}
  if (keyword) {
    whereClause.name = { [Op.like]: `%${keyword}%` }
    // có thể mở rộng:
    // whereClause = { [Op.or]: [{ name: { [Op.like]: `%${keyword}%` } }, { author: { [Op.like]: `%${keyword}%` } }] }
  }

  // lọc theo status (FE không gửi khi = 'all')
  const ALLOWED_STATUS = ['coming_soon', 'ongoing', 'completed']
  if (status && ALLOWED_STATUS.includes(status)) {
    whereClause.status = status
  }

  // include mặc định (không lọc theo category)
  let categoryInclude = {
    model: Category,
    as: 'category_id_categories',
    attributes: ['id', 'name'],
    through: { attributes: [] }, // ẩn cột bảng trung gian
    required: false,
  }

  // nếu có categoryIds[] thì lọc many-to-many qua include.where
  if (categoryIds) {
    const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds]
    const safeIds = ids.map((v) => Number(v)).filter(Number.isInteger)

    if (safeIds.length) {
      categoryInclude = {
        ...categoryInclude,
        where: { id: { [Op.in]: safeIds } },
        required: true, // bắt buộc khớp category khi lọc
      }
    }
  }

  // include 3 chương mới nhất cho MỖI story
  const chapterInclude = {
    model: Chapter,
    as: 'chapters',
    // attributes: ['id', 'name', 'slug', 'created_at'],
    order: [['id', 'DESC']],
    limit: 3,
    separate: true,
    required: false,
  }

  const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const sortWhitelist = ['id', 'name', 'total_view', 'total_follow', 'created_at', 'updated_at']
  const isViewSort = sort === 'view_day' || sort === 'view_week' || sort === 'view_month' || sort === 'view_all'

  let orderClause
  if (!isViewSort) {
    const sortColumn = sortWhitelist.includes(String(sort)) ? String(sort) : 'id'
    orderClause = [[sortColumn, sortOrder]]
  } else if (sort === 'view_all') {
    // dùng counter tổng có sẵn
    orderClause = [
      [Story.sequelize.literal('total_view'), sortOrder],
      ['updated_at', 'DESC'],
      ['id', 'DESC']
    ]
  } else {
    const start = getStartAt(sort)
    const startStr = new Date(start).toISOString().slice(0, 19).replace('T', ' ')
    const escStart = Story.sequelize.escape(startStr)

    const expr = `(SELECT COUNT(*) FROM story_views sv
                  WHERE sv.story_id = stories.id
                    AND sv.created_at >= ${escStart})`
    
    orderClause = [
      [Story.sequelize.literal(expr), sortOrder],
      ['updated_at', 'DESC'],
      ['id', 'DESC']
    ]
  }

  const result = await Story.findAndCountAll({
    where: whereClause,
    include: [categoryInclude, chapterInclude],
    order: orderClause,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    distinct: true,
    // subQuery: false,
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

function getStartAt(key) {
  const now = new Date()
  if (key === 'view_day') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d
  }
  if (key === 'view_week') {
    const d = new Date(now)
    const day = (d.getDay() + 6) % 7 // Monday=0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d
  }
  if (key === 'view_month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    d.setHours(0, 0, 0, 0);
    return d
  }
  return null
}

const getStoryDetail = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user?.id || null

  const story = await Story.findByPk(id, {
    include: [
      {
        model: Category,
        as: 'category_id_categories',
        attributes: ['id', 'name'],
        through: { attributes: [] },
        required: false,
      },
    ],
  })

  if (!story) {
    throw new NotFoundError('Không tìm thấy truyện')
  }

  let is_followed = false
  if (userId) {
    const ex = await UserFollow.findOne({
      where: { user_id: userId, story_id: id },
      attributes: ['user_id'],
      raw: true,
    })
    is_followed = !!ex
  }

  const payload = story.toJSON()
  payload.is_followed = is_followed

  res.status(200).json(payload)
})

// Upsert chấm sao truyện + cập nhật avg & count
const rateStory = asyncHandler(async (req, res) => {
  const storyId = Number(req.params.id)
  const userId = req.user?.id
  const { rating } = req.body

  if (!userId) return res.status(401).json({ message: 'Cần đăng nhập' })
  const r = Number(rating)
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ message: 'rating phải trong khoảng 1..5' })
  }

  const story = await Story.findByPk(storyId)
  if (!story) return res.status(404).json({ message: 'Không tìm thấy truyện' })

  await Story.sequelize.transaction(async (t) => {
    // upsert rating
    const [row, created] = await StoryRating.findOrCreate({
      where: { story_id: storyId, user_id: userId },
      defaults: { story_id: storyId, user_id: userId, rating: r },
      transaction: t,
    })

    if (!created && row.rating !== r) {
      row.rating = r
      await row.save({ transaction: t })
    }

    // tính lại avg & count rồi cập nhật vào stories
    const agg = await StoryRating.findOne({
      where: { story_id: storyId },
      attributes: [
        [fn('AVG', col('rating')), 'avg'],
        [fn('COUNT', col('*')), 'cnt'],
      ],
      raw: true,
      transaction: t,
    })

    const avg = Number(agg.avg || 0).toFixed(2)
    const cnt = Number(agg.cnt || 0)

    await Story.update(
      { avg_rating: avg, ratings_count: cnt },
      { where: { id: storyId }, transaction: t }
    )
  })

  return res.status(200).json({ message: 'Đã ghi nhận đánh giá' })
})

// Lấy tổng quan rating (avg, count, phân phối 1..5)
const getRatingSummary = asyncHandler(async (req, res) => {
  const storyId = Number(req.params.id)

  const story = await Story.findByPk(storyId, {
    attributes: ['id', 'avg_rating', 'ratings_count']
  })
  if (!story) return res.status(404).json({ message: 'Không tìm thấy truyện' })

  // phân phối 1..5
  const dist = await StoryRating.findAll({
    where: { story_id: storyId },
    attributes: ['rating', [fn('COUNT', col('*')), 'count']],
    group: ['rating'],
    raw: true,
  })

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of dist) distribution[String(r.rating)] = Number(r.count)


  return res.status(200).json({
    story_id: story.id,
    avg_rating: Number(story.avg_rating),
    ratings_count: Number(story.ratings_count),
    distribution,
  })
})

// Lấy bình luận theo truyện (gộp tất cả chapter)
const getStoryComments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, order = 'desc' } = req.query
  const storyId = Number(req.params.id)
  const userId = req.user?.id || null

  const story = await Story.findByPk(storyId)
  if (!story) return res.status(404).json({ message: 'Không tìm thấy truyện' })

  const offset = (Number(page) - 1) * Number(limit)
  const orderClause = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  const { rows, count } = await StoryComment.findAndCountAll({
    where: { story_id: storyId, parent_id: null },
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
      // đếm like nhanh bằng subquery
      {
        model: StoryComment,
        as: 'story_comments',
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
        separate: true,
        order: [['created_at', 'ASC']]
      },
    ],
    order: [['created_at', orderClause], ['id', orderClause]],
    limit: Number(limit),
    offset,
    distinct: true,
  })

  res.status(200).json({
    data: rows,
    meta: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    }
  })
})

module.exports = {
  getStoryList,
  getStoryDetail,
  rateStory,
  getRatingSummary,
  getStoryComments,
}
