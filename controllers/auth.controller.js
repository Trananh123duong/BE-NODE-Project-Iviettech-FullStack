const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const { users: User } = require('../models')
const asyncHandler = require('express-async-handler')
const { UnauthorizedError, ForbiddenError, BadRequestError } = require('../utils/ApiError')


const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ where: { email } })
  if (existingUser) {
    throw new BadRequestError('Email đã được sử dụng')
  }

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

  const isVip = computeIsVip(user)

  res.status(200).json({
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      vip_started_at: user.vip_started_at,
      vip_expires_at: user.vip_expires_at,
      isVip,
    },
    accessToken,
    refreshToken,
  });
});

const logout = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Chưa đăng nhập');

  const user = await User.findByPk(userId);
  if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');

  await user.update({ refresh_token: null });

  return res.status(200).json({ message: 'Đã đăng xuất' });
});

function computeIsVip(user) {
  return !!user?.vip_expires_at && new Date(user.vip_expires_at) > new Date()
}

const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password', 'refresh_token'] }
  })
  const isVip = !!user?.vip_expires_at && new Date(user.vip_expires_at) > new Date()
  res.status(200).json({ ...user.toJSON(), isVip })
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

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username } = req.body || {};

  if (typeof username !== 'string' || !username.trim()) {
    throw new BadRequestError('Username không hợp lệ');
  }

  const nextUsername = username.trim();
  if (nextUsername.length > 50) {
    throw new BadRequestError('Username tối đa 50 ký tự');
  }

  const user = await User.findByPk(userId);
  if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');

  if (nextUsername === user.username) {
    return res.status(200).json({
      message: 'Username không thay đổi',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  }

  // kiểm tra trùng username (loại trừ chính mình)
  const isTaken = await User.count({
    where: { username: nextUsername, id: { [Op.ne]: userId } }
  });
  if (isTaken) throw new BadRequestError('Username đã được sử dụng');

  await user.update({ username: nextUsername });

  // trả về user an toàn
  const { password, refresh_token, ...safeUser } = user.toJSON();
  res.status(200).json({
    message: 'Cập nhật username thành công',
    user: safeUser
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body || {};

  if (!userId) throw new UnauthorizedError('Chưa đăng nhập');
  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Thiếu currentPassword hoặc newPassword');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new BadRequestError('Mật khẩu mới phải có ít nhất 8 ký tự');
  }
  if (newPassword === currentPassword) {
    throw new BadRequestError('Mật khẩu mới không được trùng mật khẩu hiện tại');
  }

  const user = await User.findByPk(userId);
  if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new UnauthorizedError('Mật khẩu hiện tại không đúng');

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  // Lưu mật khẩu mới và vô hiệu hóa refresh token cũ
  await user.update({ password: hashed, refresh_token: null });

  return res.status(200).json({
    message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại để tiếp tục.'
  });
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) throw new UnauthorizedError('Chưa đăng nhập')
  if (!req.file) throw new BadRequestError('Không có file được tải lên')

  const user = await User.findByPk(userId)
  if (!user) throw new UnauthorizedError('Không tìm thấy người dùng')

  // Xoá file avatar cũ (nếu là file local trong /uploads/avatar)
  try {
    const old = user.avatar
    if (old && /^\/?uploads\/avatar\//.test(old)) {
      const oldPath = path.join(process.cwd(), old.replace(/^\//, ''))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
  } catch (e) {
    // không chặn flow nếu xoá thất bại
    console.error('Remove old avatar failed:', e?.message || e)
  }

  // Lưu đường dẫn mới (dùng prefix / để khớp util toAbsolute trên FE)
  const storedPath = `/uploads/avatar/${req.file.filename}`
  await user.update({ avatar: storedPath })

  // trả về user safe
  const { password, refresh_token, ...safeUser } = user.toJSON()
  res.status(200).json({
    message: 'Tải lên avatar thành công',
    user: safeUser,
  })
})

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