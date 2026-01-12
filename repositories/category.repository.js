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

  async findByName(name) {
    return await this.model.findOne({ where: { name } });
  }
}

module.exports = new CategoryRepository();
