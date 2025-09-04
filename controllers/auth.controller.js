const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { users: User } = require('../models');
const asyncHandler = require('express-async-handler')

const { UnauthorizedError, ForbiddenError } = require('../utils/ApiError')

const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  const newUser = await User.create({
    username,
    email,
    password: hashedPassword
  })

  res.status(201).json(newUser);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('Email hoặc mật khẩu không đúng!');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Email hoặc mật khẩu không đúng!');
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(tokenPayload, process.env.JWT_KEY, { expiresIn: '1h' });
  const refreshToken = jwt.sign(tokenPayload, process.env.JWT_KEY, { expiresIn: '30d' });

  await user.update({ refresh_token: refreshToken });

  res.status(200).json({
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password'] }, // Exclude password from response
  })
  res.status(200).json(user)
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    throw new UnauthorizedError('No refresh token provided');
  }

  const user = await User.findOne({ where: { refresh_token: token } });
  if (!user) {
    throw new ForbiddenError('Invalid refresh token');
  }

  jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
    if (err || decoded.id !== user.id) {
      throw new ForbiddenError('Invalid refresh token');
    }

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );

    res.status(200).json({ accessToken: newAccessToken });
  });
});

module.exports = {
  register,
  login,
  getMyProfile,
  refreshAccessToken
};