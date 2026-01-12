const BaseRepository = require('./base.repository');
const { categories: Category } = require('../models');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(Category);
  }

  async getAllCategories() {
    return await this.model.findAll({
      attributes: ['id', 'name'],
      order: [['id', 'ASC']],
    });
  }
}

module.exports = new CategoryRepository();
