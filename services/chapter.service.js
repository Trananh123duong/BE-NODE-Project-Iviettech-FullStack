const ChapterRepository = require('../repositories/chapter.repository');
const StoryRepository = require('../repositories/story.repository');
const StoryCommentRepository = require('../repositories/story_comment.repository');
const CommentLikeRepository = require('../repositories/comment_like.repository');
const { user_follows: UserFollow, reading_history: ReadingHistory, stories: Story, chapters: Chapter, story_comments: StoryComment, comment_likes: CommentLike } = require('../models'); 
const { NotFoundError, ApiError } = require('../utils/ApiError');

class ChapterService {
  async getChaptersByStory(storyId, userId) {
    const story = await StoryRepository.findById(storyId);
    if (!story) throw new NotFoundError('Không tìm thấy truyện');

    const chapters = await ChapterRepository.findByStoryId(storyId);

    let history = null;
    if (userId) {
      history = await ReadingHistory.findOne({
        where: { user_id: userId, story_id: storyId },
        attributes: ['chapter_id', 'last_read_at'],
      });
    }

    return { chapters, history };
  }

  async getChapterDetail(id, userId) {
    const chapter = await ChapterRepository.findDetail(id);
    if (!chapter) throw new NotFoundError('Không tìm thấy chapter');

    const [prevChapter, nextChapter, story] = await Promise.all([
      ChapterRepository.findPreviousChapter(chapter.story_id, chapter.chapter_number),
      ChapterRepository.findNextChapter(chapter.story_id, chapter.chapter_number),
      StoryRepository.findById(chapter.story_id, { attributes: ['id', 'name'] }),
    ]);

    await ChapterRepository.incrementView(chapter.story_id, userId);

    let is_following = false;
    if (userId) {
      await ChapterRepository.updateReadingHistory(userId, chapter.story_id, chapter.id);
      
      const follow = await UserFollow.findOne({
        where: { user_id: userId, story_id: chapter.story_id },
        attributes: ['user_id'],
      });
      is_following = !!follow;
    }

    return {
      ...chapter.toJSON(),
      story_name: story?.name,
      previousChapterId: prevChapter ? prevChapter.id : null,
      nextChapterId: nextChapter ? nextChapter.id : null,
      is_following,
    };
  }

  async getChapterComments(chapterId, query, userId) {
    const { page = 1, limit = 20, order = 'desc' } = query;
    const offset = (Number(page) - 1) * Number(limit);
    const orderClause = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const chapter = await ChapterRepository.findById(chapterId, { attributes: ['id', 'story_id'] });
    if (!chapter) throw new NotFoundError('Không tìm thấy chapter');

    const { rows, count } = await StoryComment.findAndCountAll({
        where: { chapter_id: chapterId, parent_id: null },
        include: [
          { model: require('../models').users, as: 'user', attributes: ['id', 'username', 'avatar'] },
          {
            model: StoryComment,
            as: 'story_comments',
            include: [{ model: require('../models').users, as: 'user', attributes: ['id', 'username', 'avatar'] }],
            separate: true, // This is key for efficiency
            order: [['created_at', 'ASC'], ['id', 'ASC']],
          },
        ],
        order: [['created_at', orderClause], ['id', orderClause]],
        limit: Number(limit),
        offset,
        distinct: true,
      });

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

  async createChapterComment(chapterId, userId, { body, parent_id }) {
    if (!userId) throw new ApiError(401, 'Cần đăng nhập');
    if (!body || String(body).trim().length === 0) {
      throw new ApiError(400, 'Nội dung bình luận là bắt buộc');
    }

    const chapter = await ChapterRepository.findById(chapterId);
    if (!chapter) throw new NotFoundError('Không tìm thấy chapter');

    if (parent_id) {
       const parent = await StoryComment.findByPk(parent_id, { attributes: ['id', 'chapter_id'] });
       if (!parent || parent.chapter_id !== chapterId) {
         throw new ApiError(400, 'parent_id không hợp lệ');
       }
    }

    let newComment;
    await Story.sequelize.transaction(async (t) => {
      newComment = await StoryComment.create(
        {
          story_id: chapter.story_id,
          chapter_id: chapterId,
          user_id: userId,
          parent_id: parent_id || null,
          body,
        },
        { transaction: t }
      );

      const [storyCount, chapterCount] = await Promise.all([
        StoryComment.count({ where: { story_id: chapter.story_id }, transaction: t }),
        StoryComment.count({ where: { chapter_id: chapterId }, transaction: t }),
      ]);

      await Promise.all([
        Story.update({ comments_count: storyCount }, { where: { id: chapter.story_id }, transaction: t }),
        Chapter.update({ comments_count: chapterCount }, { where: { id: chapterId }, transaction: t }),
      ]);
    });

    return newComment;
  }

  async deleteComment(id, userId, userRole) {
    if (!userId) throw new ApiError(401, 'Cần đăng nhập');

    const comment = await StoryComment.findByPk(id);
    if (!comment) throw new NotFoundError('Không tìm thấy bình luận');

    if (comment.user_id !== userId && !userRole) {
      throw new ApiError(403, 'Không có quyền xoá bình luận này');
    }

    await Story.sequelize.transaction(async (t) => {
      await comment.destroy({ transaction: t });

      const [storyCount, chapterCount] = await Promise.all([
        StoryComment.count({ where: { story_id: comment.story_id }, transaction: t }),
        comment.chapter_id
          ? StoryComment.count({ where: { chapter_id: comment.chapter_id }, transaction: t })
          : Promise.resolve(null),
      ]);

      await Story.update({ comments_count: storyCount }, { where: { id: comment.story_id }, transaction: t });
      if (comment.chapter_id && chapterCount !== null) {
        await Chapter.update({ comments_count: chapterCount }, { where: { id: comment.chapter_id }, transaction: t });
      }
    });

    return { message: 'Đã xoá bình luận' };
  }

  async likeComment(commentId, userId) {
    if (!userId) throw new ApiError(401, 'Cần đăng nhập');

    const comment = await StoryComment.findByPk(commentId, { attributes: ['id'] });
    if (!comment) throw new NotFoundError('Không tìm thấy bình luận');

    await CommentLike.findOrCreate({
        where: { comment_id: commentId, user_id: userId },
        defaults: { comment_id: commentId, user_id: userId },
    });

    const likes_count = await CommentLike.count({ where: { comment_id: commentId } });
    return { is_liked: true, likes_count };
  }

  async unlikeComment(commentId, userId) {
    if (!userId) throw new ApiError(401, 'Cần đăng nhập');

    const comment = await StoryComment.findByPk(commentId, { attributes: ['id'] });
    if (!comment) throw new NotFoundError('Không tìm thấy bình luận');

    await CommentLike.destroy({ where: { comment_id: commentId, user_id: userId } });

    const likes_count = await CommentLike.count({ where: { comment_id: commentId } });
    return { is_liked: false, likes_count };
  }
}

module.exports = new ChapterService();
