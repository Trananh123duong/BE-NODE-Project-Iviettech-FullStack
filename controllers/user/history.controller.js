const asyncHandler = require('express-async-handler');
const HistoryService = require('../../services/history.service');

const listMyHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await HistoryService.listMyHistory(userId, req.query);
  res.status(200).json(result);
});

const deleteMyHistoryItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const result = await HistoryService.deleteMyHistoryItem(id, userId);
  res.status(200).json(result);
});

module.exports = {
  listMyHistory,
  deleteMyHistoryItem,
};
