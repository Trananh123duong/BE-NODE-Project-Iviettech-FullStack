const FollowRepository = require('../repositories/follow.repository');
const StoryRepository = require('../repositories/story.repository');
const { NotFoundError } = require('../utils/ApiError');

class FollowService {
  async listMyFollowedStories(userId, query) {
    const { page = 1, limit = 10 } = query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await FollowRepository.findUserFollows(userId, { limit: Number(limit), offset });
    
    const totalPages = Math.ceil(result.count / parseInt(limit, 10));

    return {
      data: result.rows,
      meta: {
        total: result.count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
      },
    };
  }

  async followStory(userId, storyId) {
    const story = await StoryRepository.findById(storyId, { attributes: ['id'] });
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    const [row, created] = await FollowRepository.createFollow(userId, storyId);

    if (created) {
      await FollowRepository.incrementStoryFollow(storyId);
    }

    return {
      is_followed: true,
      message: created ? 'Đã theo dõi truyện' : 'Đã theo dõi trước đó',
    };
  }

  async unfollowStory(userId, storyId) {
    const story = await StoryRepository.findById(storyId, { attributes: ['id'] });
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    const deleted = await FollowRepository.removeFollow(userId, storyId);

    if (deleted) {
      await FollowRepository.decrementStoryFollow(storyId);
    }

    return {
      is_followed: false,
      message: deleted ? 'Đã bỏ theo dõi' : 'Bạn chưa theo dõi truyện này',
    };
  }
}

module.exports = new FollowService();
