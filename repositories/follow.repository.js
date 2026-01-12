const BaseRepository = require('./base.repository');
const { 
  user_follows: UserFollow, 
  stories: Story, 
  chapters: Chapter 
} = require('../models');
const { Op } = require('sequelize');

class FollowRepository extends BaseRepository {
  constructor() {
    super(UserFollow);
  }

  async findByUserIdAndStoryId(userId, storyId) {
    return await this.model.findOne({
      where: { user_id: userId, story_id: storyId },
    });
  }

  async findUserFollows(userId, { limit, offset }) {
    return await Story.findAndCountAll({
      include: [
        {
          model: UserFollow,
          as: 'user_follows',
          attributes: ['created_at'],
          where: { user_id: userId },
          required: true,
        },
        {
          model: Chapter,
          as: 'chapters',
          order: [['id', 'DESC']],
          limit: 3,
        },
      ],
      order: [[{ model: UserFollow, as: 'user_follows' }, 'created_at', 'DESC']],
      limit,
      offset,
    });
  }

  async createFollow(userId, storyId) {
    return await this.model.findOrCreate({
      where: { user_id: userId, story_id: storyId },
      defaults: { user_id: userId, story_id: storyId },
    });
  }

  async removeFollow(userId, storyId) {
      return await this.model.destroy({
        where: { user_id: userId, story_id: storyId },
      });
  }

  async incrementStoryFollow(storyId) {
      return await Story.increment('total_follow', { by: 1, where: { id: storyId } });
  }

  async decrementStoryFollow(storyId) {
      return await Story.decrement('total_follow', {
        by: 1,
        where: { id: storyId, total_follow: { [Op.gt]: 0 } },
      });
  }
}

module.exports = new FollowRepository();
