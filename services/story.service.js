const StoryRepository = require('../repositories/story.repository');
const StoryRatingRepository = require('../repositories/story_rating.repository');
const StoryCommentRepository = require('../repositories/story_comment.repository');
const CommentLikeRepository = require('../repositories/comment_like.repository');
const { user_follows: UserFollow } = require('../models');
const { NotFoundError, ApiError } = require('../utils/ApiError');

class StoryService {
  async getStoryList(query) {
    const {
      page = 1,
      limit = 10,
      sort = 'id',
      order = 'desc',
      keyword,
      status,
    } = query;
    const categoryIds = query['categoryIds[]'];

    const result = await StoryRepository.findAndCountList({
      page,
      limit,
      sort,
      order,
      keyword,
      status,
      categoryIds,
    });

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

  async getStoryDetail(id, userId) {
    const story = await StoryRepository.findDetail(id);
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    let is_followed = false;
    if (userId) {
      // NOTE: Consider moving this to a UserFollowRepository later
      const ex = await UserFollow.findOne({
        where: { user_id: userId, story_id: id },
        attributes: ['user_id'],
        raw: true,
      });
      is_followed = !!ex;
    }

    const payload = story.toJSON();
    payload.is_followed = is_followed;

    return payload;
  }

  async rateStory(storyId, userId, rating) {
    if (!userId) throw new ApiError(401, 'Cần đăng nhập');

    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new ApiError(400, 'rating phải trong khoảng 1..5');
    }

    const story = await StoryRepository.findById(storyId);
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    await StoryRatingRepository.upsertRating(storyId, userId, r);

    return { message: 'Đã ghi nhận đánh giá' };
  }

  async getRatingSummary(storyId, userId) {
    const story = await StoryRepository.findById(storyId, {
      attributes: ['id', 'avg_rating', 'ratings_count']
    });
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    const distribution = await StoryRatingRepository.getDistribution(storyId);
    const user_rating = await StoryRatingRepository.getUserRating(storyId, userId);

    return {
      story_id: story.id,
      avg_rating: Number(story.avg_rating),
      ratings_count: Number(story.ratings_count),
      distribution,
      user_rating,
    };
  }

  async getStoryComments(storyId, query, userId) {
    const { page = 1, limit = 20, order = 'desc' } = query;
    const offset = (Number(page) - 1) * Number(limit);
    const orderClause = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const story = await StoryRepository.findById(storyId, { attributes: ['id'] });
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    const { rows, count } = await StoryCommentRepository.findComments(storyId, {
      limit: Number(limit),
      offset,
      orderClause
    });

    // Gom ID de lay like count
    const allIds = [];
    for (const c of rows) {
      allIds.push(c.id);
      if (Array.isArray(c.story_comments)) {
        for (const r of c.story_comments) allIds.push(r.id);
      }
    }

    const likeCountMap = await CommentLikeRepository.getLikeCounts(allIds);
    const likedSet = await CommentLikeRepository.getUserLikedSet(userId, allIds);

    const data = rows.map((c) => {
      const parent = c.toJSON();
      parent.likes_count = likeCountMap.get(c.id) || 0;
      parent.is_liked = likedSet.has(c.id);

      parent.story_comments = (parent.story_comments || []).map((r) => ({
        ...r,
        likes_count: likeCountMap.get(r.id) || 0,
        is_liked: likedSet.has(r.id),
      }));

      return parent;
    });

    return {
      data,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  }
}

module.exports = new StoryService();
