const asyncHandler = require('express-async-handler')
const { ApiError, NotFoundError } = require('../../utils/ApiError')
const { Op, Sequelize } = require('sequelize')

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
        as: 'chapter_images',  //Alias của quan hệ, lưu trong init-models
        attributes: ['id', 'img_path', 'img_type', 'sort_order'],
        order: [
          ['sort_order', 'ASC'],
          ['id', 'ASC'],
        ],
      },
    ],
  })
  if (!chapter) throw new NotFoundError('Không tìm thấy chapter')

  const [prevChapter, nextChapter, story] = await Promise.all([ //Nhận vào mảng Promises và chạy đồng thời
    Chapter.findOne({
      where: {
        story_id: chapter.story_id,
        chapter_number: { [Op.lt]: chapter.chapter_number }, //Less Than – nhỏ hơn '<'
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
        chapter_number: { [Op.gt]: chapter.chapter_number }, //Greater Than – lớn hơn '>'
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
  await Story.increment('total_view', { //👉 Tăng cột total_view trong bảng stories lên 1 đơn vị
    by: 1,
    where: { id: chapter.story_id },
  })

  let is_following = false
  if (userId) {
    await ReadingHistory.upsert({ //Tạo mới hoặc cập nhật keo index uk_user_story
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

const getChapterComments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, order = 'desc' } = req.query
  const chapterId = Number(req.params.id)
  const userId = req.user?.id ? Number(req.user.id) : null

  const chapter = await Chapter.findByPk(chapterId, { attributes: ['id', 'story_id'] })
  if (!chapter) throw new NotFoundError('Không tìm thấy chapter')

  const offset = (Number(page) - 1) * Number(limit)
  const orderClause = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  // 1) Lấy comment gốc + reply (1 cấp)
  const { rows, count } = await StoryComment.findAndCountAll({
    where: { chapter_id: chapterId, parent_id: null },
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
    limit: Number(limit),
    offset,
    distinct: true,
  })

  // 2) Gom tất cả ID (gốc + reply)
  const allIds = []
  for (const c of rows) {
    allIds.push(c.id)
    if (Array.isArray(c.story_comments)) {
      for (const r of c.story_comments) allIds.push(r.id)
    }
  }

  // 3) Lấy map đếm like và set các comment user đã like
  let likeCountMap = new Map()
  let likedSet = new Set()

  if (allIds.length > 0) {
    // 3a) Tổng like theo comment_id
    const likeCounts = await CommentLike.findAll({
      where: { comment_id: { [Op.in]: allIds } },
      attributes: ['comment_id', [CommentLike.sequelize.fn('COUNT', CommentLike.sequelize.col('*')), 'cnt']],
      group: ['comment_id'],
      raw: true,
    })
    for (const row of likeCounts) {
      likeCountMap.set(Number(row.comment_id), Number(row.cnt))
    }

    // 3b) Những comment user hiện tại đã like
    if (userId) {
      const likedRows = await CommentLike.findAll({
        where: { user_id: userId, comment_id: { [Op.in]: allIds } },
        attributes: ['comment_id'],
        raw: true,
      })
      likedSet = new Set(likedRows.map(r => Number(r.comment_id)))
    }
  }

  // 4) Gắn likes_count + is_liked vào payload trả về
  const data = rows.map((c) => {
    const parent = c.toJSON()
    parent.likes_count = likeCountMap.get(c.id) || 0
    parent.is_liked = likedSet.has(c.id)

    parent.story_comments = (parent.story_comments || []).map((r) => ({
      ...r,
      likes_count: likeCountMap.get(r.id) || 0,
      is_liked: likedSet.has(r.id),
    }))

    return parent
  })

  return res.status(200).json({
    data,
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
    await comment.destroy({ transaction: t })

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

// Thích bình luận
const likeComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const userId = req.user?.id
  if (!userId) throw new ApiError(401, 'Cần đăng nhập')

  const comment = await StoryComment.findByPk(id, { attributes: ['id'] })
  if (!comment) throw new NotFoundError('Không tìm thấy bình luận')

  await CommentLike.findOrCreate({
    where: { comment_id: id, user_id: userId },
    defaults: { comment_id: id, user_id: userId },
  })

  const likes_count = await CommentLike.count({ where: { comment_id: id } })
  return res.status(200).json({ is_liked: true, likes_count })
})

const unlikeComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const userId = req.user?.id
  if (!userId) throw new ApiError(401, 'Cần đăng nhập')

  const comment = await StoryComment.findByPk(id, { attributes: ['id'] })
  if (!comment) throw new NotFoundError('Không tìm thấy bình luận')

  await CommentLike.destroy({ where: { comment_id: id, user_id: userId } })

  const likes_count = await CommentLike.count({ where: { comment_id: id } })
  return res.status(200).json({ is_liked: false, likes_count })
})

module.exports = {
  getChaptersByStory,
  getChapterDetail,
  getChapterComments,
  createChapterComment,
  deleteComment,
  likeComment,
  unlikeComment
}
