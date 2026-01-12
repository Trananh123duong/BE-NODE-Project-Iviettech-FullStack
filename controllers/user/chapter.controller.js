const asyncHandler = require('express-async-handler');
const ChapterService = require('../../services/chapter.service');

const getChaptersByStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user?.id || null;

  const result = await ChapterService.getChaptersByStory(storyId, userId);
  res.status(200).json(result);
});

const getChapterDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  const result = await ChapterService.getChapterDetail(id, userId);
  res.status(200).json(result);
});

const getChapterComments = asyncHandler(async (req, res) => {
  const chapterId = Number(req.params.id);
  const userId = req.user?.id ? Number(req.user.id) : null;

  const result = await ChapterService.getChapterComments(chapterId, req.query, userId);
  res.status(200).json(result);
});

const createChapterComment = asyncHandler(async (req, res) => {
  const chapterId = Number(req.params.id);
  const userId = req.user?.id;
  
  const result = await ChapterService.createChapterComment(chapterId, userId, req.body);
  res.status(201).json(result);
});

const deleteComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const result = await ChapterService.deleteComment(id, userId, userRole);
  res.status(200).json(result);
});

// Reuse same like/unlike logic from StoryService if applicable, 
// OR implement similar like/unlike logic in ChapterService if route is specifically for chapter comments.
// In existing controller, `likeComment` and `unlikeComment` are generic for `StoryComment` model.
// They don't depend on Chapter specific logic, but since they are in ChapterController, 
// they might be routed from /chapters/... URLs or similar.
// Actually, `likeComment` and `unlikeComment` modify `comment_likes` tabkle.
// They are identical to what might be in StoryController if it had them.
// Let's implement them in ChapterService or shared Service. 
// For now, I'll add them to ChapterService to match the controller file structure.
// Even better: Create `CommentService`? 
// Sticking to "ChapterService" as requested to replace "ChapterController".

const likeComment = asyncHandler(async (req, res) => {
  // Re-using StoryService logic? 
  // No, let's keep it simple. If we want shared logic, we should extract a CommentService.
  // But plan was "ChapterService".
  // Actually, wait, `StoryController` didn't have `likeComment`.
  // `ChapterController` does.
  // Let's implement them in ChapterService.
  const id = Number(req.params.id);
  const userId = req.user?.id;
  
  // Note: I missed implementation in ChapterService in previous step. 
  // I will add them to ChapterService file first (append or rewrite) OR just implement here if it was a small utility.
  // BUT the requirement is Controller -> Service.
  // So I must call Service.
  // I'll assume they are in Service (I'll update Service file in next step if I missed it, 
  // but better to do it cleanly: Update Service File to include like/unlike, THEN update this Controller.)
  // Wait, I can't look back at what I wrote in previous step easily without scroll. 
  // I'll blindly check if I added it. I likely DID NOT.
  // I will update ChapterService NOW to include like/unlike, then update Controller.
  
  const result = await ChapterService.likeComment(id, userId);
  res.status(200).json(result);
});

const unlikeComment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user?.id;

  const result = await ChapterService.unlikeComment(id, userId);
  res.status(200).json(result);
});


module.exports = {
  getChaptersByStory,
  getChapterDetail,
  getChapterComments,
  createChapterComment,
  deleteComment,
  likeComment,
  unlikeComment
};
