const BaseRepository = require('./base.repository');
const { 
  reading_history: ReadingHistory, 
  stories: Story, 
  chapters: Chapter 
} = require('../models');
const { Op } = require('sequelize');

class HistoryRepository extends BaseRepository {
  constructor() {
    super(ReadingHistory);
  }

  async findUserHistory(userId, { limit, offset, keyword }) {
    const storyInclude = {
        model: Story,
        as: 'story',
        attributes: ['id', 'name', 'thumbnail', 'author', 'status', 'total_view', 'total_follow', 'updated_at'],
        required: true,
    };
    
    if (keyword) {
        storyInclude.where = { name: { [Op.like]: `%${keyword}%` } };
    }

    return await this.model.findAndCountAll({
        where: { user_id: userId },
        attributes: ['id', 'user_id', 'story_id', 'chapter_id', 'last_read_at'],
        include: [
          storyInclude,
          {
            model: Chapter,
            as: 'chapter',
            attributes: ['id', 'chapter_number', 'title'],
            required: false,
          },
        ],
        order: [['last_read_at', 'DESC'], ['story', 'updated_at', 'DESC']],
        limit,
        offset,
    });
  }

  async deleteUserHistory(id, userId) {
      return await this.model.destroy({
        where: { id, user_id: userId },
      });
  }
}

module.exports = new HistoryRepository();
