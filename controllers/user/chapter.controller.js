const asyncHandler = require('express-async-handler')
const { ApiError, NotFoundError } = require('../../utils/ApiError')
const { Op } = require('sequelize')

const {
  chapters: Chapter,
  stories: Story,
  chapter_images: ChapterImage,
  story_views: StoryView,
  reading_history: ReadingHistory,
  user_follows: UserFollow,
  story_comments: StoryComment,
  comment_likes: CommentLike,
  users: User,
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

  return res.status(200).json({ chapters, history })
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
  if (!chapter) throw new NotFoundError('Không tìm thấy chapter')

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
    Story.findByPk(chapter.story_id, { attributes: ['id', 'name'] }),
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

// Lấy danh sách bình luận theo chapter (kèm reply 1 cấp)
const getChapterComments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, order = 'desc' } = req.query
  const chapterId = Number(req.params.id)

  const chapter = await Chapter.findByPk(chapterId, { attributes: ['id', 'story_id'] })
  if (!chapter) throw new NotFoundError('Không tìm thấy chapter')

  const offset = (Number(page) - 1) * Number(limit)
  const orderClause = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  const { rows, count } = await StoryComment.findAndCountAll({
    where: { chapter_id: chapterId, parent_id: null },
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'avatar'] },
      {
        model: StoryComment,
        as: 'story_comments',
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatar'] }],
        separate: true,
        order: [['created_at', 'ASC']],
      },
    ],
    order: [['created_at', orderClause], ['id', orderClause]],
    limit: Number(limit),
    offset,
    distinct: true,
  })

  return res.status(200).json({
    data: rows,
    meta: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    },
  })
})

// Tạo bình luận (comment gốc hoặc reply)
const createChapterComment = asyncHandler(async (req, res) => {
  const chapterId = Number(req.params.id)
  const userId = req.user?.id
  const { body, parent_id = null } = req.body || {}

  if (!userId) throw new ApiError(401, 'Cần đăng nhập')
  if (!body || String(body).trim().length === 0) {
    throw new ApiError(400, 'Nội dung bình luận là bắt buộc')
  }

  const chapter = await Chapter.findByPk(chapterId, { attributes: ['id', 'story_id'] })
  if (!chapter) throw new NotFoundError('Không tìm thấy chapter')

  // nếu là reply thì parent phải thuộc cùng chapter
  if (parent_id) {
    const parent = await StoryComment.findByPk(parent_id, { attributes: ['id', 'chapter_id'] })
    if (!parent || parent.chapter_id !== chapterId) {
      throw new ApiError(400, 'parent_id không hợp lệ')
    }
  }

  let newComment
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
    )

    // cập nhật đếm comment cho story và chapter
    const [storyCount, chapterCount] = await Promise.all([
      StoryComment.count({ where: { story_id: chapter.story_id }, transaction: t }),
      StoryComment.count({ where: { chapter_id: chapterId }, transaction: t }),
    ])

    await Promise.all([
      Story.update({ comments_count: storyCount }, { where: { id: chapter.story_id }, transaction: t }),
      Chapter.update({ comments_count: chapterCount }, { where: { id: chapterId }, transaction: t }),
    ])
  })

  return res.status(201).json(newComment)
})

// Xoá mềm bình luận
const deleteComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const userId = req.user?.id
  if (!userId) throw new ApiError(401, 'Cần đăng nhập')

  const comment = await StoryComment.findByPk(id)
  if (!comment) throw new NotFoundError('Không tìm thấy bình luận')

  // cho phép chủ cmt hoặc admin (tuỳ bạn kiểm tra vai trò)
  if (comment.user_id !== userId && !req.user?.role) {
    throw new ApiError(403, 'Không có quyền xoá bình luận này')
  }

  await Story.sequelize.transaction(async (t) => {
    await comment.destroy({ transaction: t }) // paranoid: true → xoá mềm

    // cập nhật lại đếm
    const [storyCount, chapterCount] = await Promise.all([
      StoryComment.count({ where: { story_id: comment.story_id }, transaction: t }),
      comment.chapter_id
        ? StoryComment.count({ where: { chapter_id: comment.chapter_id }, transaction: t })
        : Promise.resolve(null),
    ])

    await Story.update({ comments_count: storyCount }, { where: { id: comment.story_id }, transaction: t })
    if (comment.chapter_id && chapterCount !== null) {
      await Chapter.update({ comments_count: chapterCount }, { where: { id: comment.chapter_id }, transaction: t })
    }
  })

  return res.status(200).json({ message: 'Đã xoá bình luận' })
})

// Thích / bỏ thích bình luận
const toggleLikeComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const userId = req.user?.id
  if (!userId) throw new ApiError(401, 'Cần đăng nhập')

  const comment = await StoryComment.findByPk(id)
  if (!comment) throw new NotFoundError('Không tìm thấy bình luận')

  const existed = await CommentLike.findOne({
    where: { comment_id: id, user_id: userId },
    attributes: ['comment_id'],
  })

  if (existed) {
    await existed.destroy()
    return res.status(200).json({ liked: false })
  } else {
    await CommentLike.create({ comment_id: id, user_id: userId })
    return res.status(200).json({ liked: true })
  }
})

module.exports = {
  getChaptersByStory,
  getChapterDetail,
  getChapterComments,
  createChapterComment,
  deleteComment,
  toggleLikeComment,
}
