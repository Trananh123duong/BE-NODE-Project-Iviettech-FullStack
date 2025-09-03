const asyncHandler = require('express-async-handler')
const { NotFoundError } = require('../../utils/ApiError')
const { chapters: Chapter, stories: Story, chapter_images: ChapterImage } = require('../../models')

const getChaptersByStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params

  const story = await Story.findByPk(storyId)
  if (!story) throw new NotFoundError('Không tìm thấy truyện')

  const chapters = await Chapter.findAll({
    where: { story_id: storyId },
    attributes: ['id', 'chapter_number', 'title', 'updatedAt'],
    order: [
      ['chapter_number', 'DESC'],
      ['id', 'DESC'],
    ],
  })

  return res.status(200).json(chapters)
})

const getChapterDetail = asyncHandler(async (req, res) => {
  const { id } = req.params

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

  return res.status(200).json(chapter)
})


module.exports = {
  getChaptersByStory,
  getChapterDetail
}
