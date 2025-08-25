// controllers/story.controller.js
const { Op } = require('sequelize')
const asyncHandler = require('express-async-handler')

const { stories: Story, categories: Category, chapters: Chapter } = require('../../models')

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
  const sortColumn = ['id', 'name', 'total_view', 'total_follow', 'created_at', 'updated_at'].includes(sort)
    ? sort
    : 'id'

  const result = await Story.findAndCountAll({
    where: whereClause,
    include: [categoryInclude, chapterInclude],
    order: [[sortColumn, sortOrder]],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    distinct: true, // cần khi JOIN n-n để count đúng
    subQuery: false,
  })

  const totalPages = Math.ceil(result.count / parseInt(limit, 10))

  res.json({
    data: result.rows,
    meta: {
      total: result.count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages,
    },
  })
})

module.exports = {
  getStoryList
}
