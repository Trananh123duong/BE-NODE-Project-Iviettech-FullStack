const BaseRepository = require('./base.repository');
const { story_comments: StoryComment, users: User } = require('../models');

class StoryCommentRepository extends BaseRepository {
  constructor() {
    super(StoryComment);
  }

  async findComments(storyId, { limit, offset, orderClause }) {
    return await this.model.findAndCountAll({
      where: { story_id: storyId, parent_id: null },
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
        {
          model: StoryComment,
          as: 'story_comments',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
          separate: true,
          order: [['created_at', 'ASC'], ['id', 'ASC']],
        },
      ],
      order: [['created_at', orderClause], ['id', orderClause]],
      limit,
      offset,
      distinct: true,
    });
  }
}

module.exports = new StoryCommentRepository();
