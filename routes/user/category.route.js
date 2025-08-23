const express = require('express')
const router = express.Router()

const categoryController = require('../../controllers/user/category.controller')

// Category
router.get('/', categoryController.getAllCategories)

module.exports = router