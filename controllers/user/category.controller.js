const asyncHandler = require('express-async-handler');
const CategoryService = require('../../services/category.service');

const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getAllCategories();
  res.status(200).json(categories);
});

module.exports = {
  getAllCategories
};