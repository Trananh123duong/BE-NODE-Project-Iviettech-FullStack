const asyncHandler = require('express-async-handler');
const StoryService = require('../../services/story.service');

const getStoryList = asyncHandler(async (req, res) => {
  const result = await StoryService.getStoryList(req.query);
  res.status(200).json(result);
});

const getStoryDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;
  const result = await StoryService.getStoryDetail(id, userId);
  res.status(200).json(result);
});

const rateStory = asyncHandler(async (req, res) => {
  const storyId = Number(req.params.id);
  const userId = req.user?.id;
  const { rating } = req.body;

  const result = await StoryService.rateStory(storyId, userId, rating);
  res.status(200).json(result);
});

const getRatingSummary = asyncHandler(async (req, res) => {
  const storyId = Number(req.params.id);
  const userId = req.user?.id || null;

  const result = await StoryService.getRatingSummary(storyId, userId);
  res.status(200).json(result);
});

const getStoryComments = asyncHandler(async (req, res) => {
  const storyId = Number(req.params.id);
  const userId = req.user?.id ? Number(req.user.id) : null;

  const result = await StoryService.getStoryComments(storyId, req.query, userId);
  res.status(200).json(result);
});

module.exports = {
  getStoryList,
  getStoryDetail,
  rateStory,
  getRatingSummary,
  getStoryComments,
};
