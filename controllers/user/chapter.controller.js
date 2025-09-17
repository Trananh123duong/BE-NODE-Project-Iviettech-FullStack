const asyncHandler = require('express-async-handler')
const { NotFoundError } = require('../../utils/ApiError')
const { Op } = require('sequelize')

const {
  chapters: Chapter,
  stories: Story,
  chapter_images: ChapterImage,
  story_views: StoryView,
  reading_history: ReadingHistory,
  user_follows: UserFollow,
} = require('../../models')

const getChaptersByStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params
  const userId = req.user?.id || null

  const story = await Story.findByPk(storyId)
  if (!story) throw new NotFoundError('Không tìm thấy truyện')

  const chapters = await Chapter.findAll({
    where: { story_id: storyId },
    attributes: ['id', 'chapter_number', 'title', 'updated_at'],
    order: [
      ['chapter_number', 'DESC'],
      ['id', 'DESC'],
    ],
  })

  let history = null
  if (userId) {
    history = await ReadingHistory.findOne({
      where: { user_id: userId, story_id: storyId },
      attributes: ['chapter_id', 'last_read_at'],
    })
  }

  return res.status(200).json({
    chapters,
    history,
  })
})

const getChapterDetail = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user?.id || null

  const chapter = await Chapter.findByPk(id, {
    attributes: ['id', 'story_id', 'chapter_number', 'title'],
    include: [
      {
        model: ChapterImage,
        as: 'chapter_images',
        attributes: ['id', 'img_path', 'img_type', 'sort_order'],
        required: false,
        separate: true,
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
      },
    ],
  })

  if (!chapter) {
    throw new NotFoundError('Không tìm thấy chapter')
  }

  // Tìm chapter liền trước / liền sau trong cùng story dựa theo chapter_number
  const [prevChapter, nextChapter, story] = await Promise.all([
    Chapter.findOne({
      where: {
        story_id: chapter.story_id,
        chapter_number: { [Op.lt]: chapter.chapter_number },
      },
      attributes: ['id'],
      order: [
        ['chapter_number', 'DESC'],
        ['id', 'DESC'],
      ],
    }),
    Chapter.findOne({
      where: {
        story_id: chapter.story_id,
        chapter_number: { [Op.gt]: chapter.chapter_number },
      },
      attributes: ['id'],
      order: [
        ['chapter_number', 'ASC'],
        ['id', 'ASC'],
      ],
    }),
    Story.findByPk(chapter.story_id, { attributes: ['id', 'name'] })
  ])

  await StoryView.create({
    story_id: chapter.story_id,
    user_id: userId,
  })
  await Story.increment('total_view', {
    by: 1,
    where: { id: chapter.story_id },
  })

  let is_following = false
  if (userId) {
    await ReadingHistory.upsert({
      user_id: userId,
      story_id: chapter.story_id,
      chapter_id: chapter.id,
      last_read_at: new Date(),
    })

    const follow = await UserFollow.findOne({
      where: { user_id: userId, story_id: chapter.story_id },
      attributes: ['user_id'],
    })
    is_following = !!follow
  }

  return res.status(200).json({
    ...chapter.toJSON(),
    story_name: story?.name,
    previousChapterId: prevChapter ? prevChapter.id : null,
    nextChapterId: nextChapter ? nextChapter.id : null,
    is_following,
  })
})

module.exports = {
  getChaptersByStory,
  getChapterDetail,
}
