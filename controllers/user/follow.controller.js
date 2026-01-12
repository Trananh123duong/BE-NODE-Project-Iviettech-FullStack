const asyncHandler = require('express-async-handler');
const FollowService = require('../../services/follow.service');

const listMyFollowedStories = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await FollowService.listMyFollowedStories(userId, req.query);
  res.status(200).json(result);
});

const followStory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { storyId } = req.params;
  const result = await FollowService.followStory(userId, storyId);
  res.status(200).json(result);
});

const unfollowStory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { storyId } = req.params;
  const result = await FollowService.unfollowStory(userId, storyId);
  res.status(200).json(result);
});

module.exports = { listMyFollowedStories, followStory, unfollowStory };
