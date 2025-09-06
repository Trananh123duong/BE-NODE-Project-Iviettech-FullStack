// controllers/story.controller.js
const { Op } = require('sequelize')
const asyncHandler = require('express-async-handler')
const { NotFoundError } = require('../../utils/ApiError')

const {
  stories: Story,
  categories: Category,
  chapters: Chapter
} = require('../../models')

const getStoryList = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort = 'id', order = 'desc', keyword } = req.query
  const categoryIds = req.query['categoryIds[]']
  const offset = (page - 1) * limit

  let whereClause = {}
  if (keyword) {
    whereClause.name = { [Op.like]: `%${keyword}%` }
    // có thể mở rộng:
    // whereClause = { [Op.or]: [{ name: { [Op.like]: `%${keyword}%` } }, { author: { [Op.like]: `%${keyword}%` } }] }
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
    subQuery: false,
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

  res.status(200).json(story)
})

module.exports = {
  getStoryList,
  getStoryDetail
}
