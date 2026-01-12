const CategoryRepository = require('../repositories/category.repository');
const { NotFoundError } = require('../utils/ApiError');

class CategoryService {
  async getAllCategories() {
    const categories = await CategoryRepository.getAllCategories();
    if (!categories || categories.length === 0) {
      throw new NotFoundError('Không tìm thấy thể loại nào');
    }
    return categories;
  }
}

module.exports = new CategoryService();
