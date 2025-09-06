const asyncHandler = require('express-async-handler')
const { NotFoundError } = require('../../utils/ApiError')
const {
  chapters: Chapter,
  stories: Story,
  chapter_images: ChapterImage,
  story_views: StoryView,
  reading_history: ReadingHistory,
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
        attributes: ['id', 'img_path', 'img_type'],
        required: false,
        order: [['id', 'ASC']],
        separate: true, // để order/limit áp dụng đúng cho mảng con
      },
    ],
  })

  if (!chapter) {
    throw new NotFoundError('Không tìm thấy chapter')
  }

  await StoryView.create({
    story_id: chapter.story_id,
    user_id: userId,
  })

  await Story.increment('total_view', {
    by: 1,
    where: { id: chapter.story_id },
  })

  if (userId) {
    await ReadingHistory.upsert({
      user_id: userId,
      story_id: chapter.story_id,
      chapter_id: chapter.id,
      last_read_at: new Date(),
    })
  }

  return res.status(200).json(chapter)
})


module.exports = {
  getChaptersByStory,
  getChapterDetail
}
