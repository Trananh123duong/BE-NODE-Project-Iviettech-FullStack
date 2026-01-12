const BaseRepository = require('./base.repository');
const { users: User } = require('../models');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return await this.findOne({ where: { email } });
  }

  async findByUsername(username) {
    return await this.findOne({ where: { username } });
  }
    
  async checkUsernameExist(username, excludeId = null) {
      const { Op } = require('sequelize');
      const where = { username };
      if (excludeId) {
          where.id = { [Op.ne]: excludeId };
      }
      const count = await this.count({ where });
      return count > 0;
  }
  
  async findByRefreshToken(token) {
      return await this.findOne({ where: { refresh_token: token } });
  }
}

module.exports = new UserRepository();
