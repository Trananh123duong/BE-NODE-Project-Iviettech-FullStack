class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    return await this.model.create(data);
  }

  async findAll(options = {}) {
    return await this.model.findAll(options);
  }

  async findById(id, options = {}) {
    return await this.model.findByPk(id, options);
  }

  async findOne(options = {}) {
    return await this.model.findOne(options);
  }

  async update(id, data) {
    const item = await this.findById(id);
    if (!item) return null;
    return await item.update(data);
  }

  async delete(id) {
    const item = await this.findById(id);
    if (!item) return false;
    await item.destroy();
    return true;
  }
  
  async count(options = {}) {
    return await this.model.count(options);
  }
}

module.exports = BaseRepository;
