const asyncHandler = require('express-async-handler');
const AuthService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const newUser = await AuthService.register(req.body);
  res.status(201).json(newUser);
});

const login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body);
  res.status(200).json(result);
});

const logout = asyncHandler(async (req, res) => {
  const result = await AuthService.logout(req.user?.id);
  return res.status(200).json(result);
});

const getMyProfile = asyncHandler(async (req, res) => {
  const result = await AuthService.getProfile(req.user.id);
  res.status(200).json(result);
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const result = await AuthService.refreshToken(req.body.token);
  res.status(200).json(result);
});

const updateProfile = asyncHandler(async (req, res) => {
  const result = await AuthService.updateProfile(req.user.id, req.body);
  res.status(200).json(result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await AuthService.changePassword(req.user?.id, req.body);
  return res.status(200).json(result);
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const result = await AuthService.uploadAvatar(req.user?.id, req.file);
  res.status(200).json(result);
});

module.exports = {
  register,
  login,
  getMyProfile,
  refreshAccessToken,
  updateProfile,
  uploadAvatar,
  changePassword,
  logout
};