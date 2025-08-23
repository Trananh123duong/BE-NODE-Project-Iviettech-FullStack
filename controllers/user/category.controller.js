const path = require('path')
const { Op } = require('sequelize')
const asyncHandler = require('express-async-handler')

const { NotFoundError } = require('../../utils/ApiError')

const { categories: Category } = require('../../models')

const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.findAll({
    attributes: ['id', 'name'],
    order: [['id', 'ASC']], 
  })

  if (!categories || categories.length === 0) {
    throw new NotFoundError('Không tìm thấy thể loại nào')
  }

  res.status(200).json({
    success: true,
    data: categories,
  })
})

module.exports = {
  getAllCategories
}