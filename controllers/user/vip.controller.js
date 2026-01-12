const asyncHandler = require('express-async-handler');
const VipService = require('../../services/vip.service');

const getVipStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await VipService.getVipStatus(userId);
  res.json(result);
});

const fakeCheckout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await VipService.fakeCheckout(userId, req.body);
  res.status(200).json(result);
});

module.exports = {
  getVipStatus,
  fakeCheckout,
};
