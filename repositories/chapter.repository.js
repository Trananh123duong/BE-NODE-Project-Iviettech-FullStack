const BaseRepository = require('./base.repository');
const { 
  chapters: Chapter, 
  chapter_images: ChapterImage, 
  stories: Story,
  story_views: StoryView,
  reading_history: ReadingHistory 
} = require('../models');
const { Op } = require('sequelize');

class ChapterRepository extends BaseRepository {
  constructor() {
    super(Chapter);
  }

  async findByStoryId(storyId) {
    return await this.model.findAll({
      where: { story_id: storyId },
      attributes: ['id', 'chapter_number', 'title', 'updated_at'],
      order: [
        ['chapter_number', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  async findDetail(id) {
    return await this.model.findByPk(id, {
      attributes: ['id', 'story_id', 'chapter_number', 'title'],
      include: [
        {
          model: ChapterImage,
          as: 'chapter_images',
          attributes: ['id', 'img_path', 'img_type', 'sort_order'],
          order: [
            ['sort_order', 'ASC'],
            ['id', 'ASC'],
          ],
        },
      ],
    });
  }

  async findPreviousChapter(storyId, currentChapterNumber) {
    return await this.model.findOne({
      where: {
        story_id: storyId,
        chapter_number: { [Op.lt]: currentChapterNumber },
      },
      attributes: ['id'],
      order: [
        ['chapter_number', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  async findNextChapter(storyId, currentChapterNumber) {
    return await this.model.findOne({
      where: {
        story_id: storyId,
        chapter_number: { [Op.gt]: currentChapterNumber },
      },
      attributes: ['id'],
      order: [
        ['chapter_number', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  async incrementView(storyId, userId = null) {
    if (userId) {
      await StoryView.create({
        story_id: storyId,
        user_id: userId,
      });
    }
    
    await Story.increment('total_view', {
      by: 1,
      where: { id: storyId },
    });
  }

  async updateReadingHistory(userId, storyId, chapterId) {
     if (!userId) return;
     
     await ReadingHistory.upsert({
      user_id: userId,
      story_id: storyId,
      chapter_id: chapterId,
      last_read_at: new Date(),
    });
  }

  async findByStoryAndNumber(storyId, chapterNumber) {
    return await this.model.findOne({
      where: { story_id: storyId, chapter_number: chapterNumber },
      attributes: ['id', 'chapter_number']
    });
  }
}

module.exports = new ChapterRepository();
