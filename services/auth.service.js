const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const UserRepository = require('../repositories/user.repository');
const { UnauthorizedError, ForbiddenError, BadRequestError } = require('../utils/ApiError');

class AuthService {
  async register({ username, email, password }) {
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      throw new BadRequestError('Email đã được sử dụng');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await UserRepository.create({
      username,
      email,
      password: hashedPassword
    });

    return newUser;
  }

  async login({ email, password }) {
    const user = await UserRepository.findByEmail(email);
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

    await UserRepository.update(user.id, { refresh_token: refreshToken });

    const isVip = this.computeIsVip(user);

    return {
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
    };
  }

  async logout(userId) {
    if (!userId) throw new UnauthorizedError('Chưa đăng nhập');
    
    // Check user exist using repository
    const user = await UserRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');

    await UserRepository.update(userId, { refresh_token: null });
    return { message: 'Đã đăng xuất' };
  }

  async refreshToken(token) {
    if (!token) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const user = await UserRepository.findByRefreshToken(token);
    if (!user) {
      throw new ForbiddenError('Invalid refresh token');
    }

    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
            if (err || decoded.id !== user.id) {
               return reject(new ForbiddenError('Invalid refresh token'));
            }
        
            const newAccessToken = jwt.sign(
              { id: user.id, email: user.email, role: user.role },
              process.env.JWT_KEY,
              { expiresIn: '1h' }
            );
        
            resolve({ accessToken: newAccessToken });
        });
    });
  }

  async getProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    
    // Remove sensitive data
    const userJson = user.toJSON();
    delete userJson.password;
    delete userJson.refresh_token;

    const isVip = !!user?.vip_expires_at && new Date(user.vip_expires_at) > new Date();
    return { ...userJson, isVip };
  }

  async updateProfile(userId, { username }) {
     if (typeof username !== 'string' || !username.trim()) {
        throw new BadRequestError('Username không hợp lệ');
      }
    
      const nextUsername = username.trim();
      if (nextUsername.length > 50) {
        throw new BadRequestError('Username tối đa 50 ký tự');
      }
    
      const user = await UserRepository.findById(userId);
      if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');
    
      if (nextUsername === user.username) {
        return {
          message: 'Username không thay đổi',
          user: this.getSafeUser(user)
        };
      }
    
      const isTaken = await UserRepository.checkUsernameExist(nextUsername, userId);
      if (isTaken) throw new BadRequestError('Username đã được sử dụng');
    
      await UserRepository.update(userId, { username: nextUsername });
      
      // Fetch updated user to return correct data
      const updatedUser = await UserRepository.findById(userId);

      return {
        message: 'Cập nhật username thành công',
        user: this.getSafeUser(updatedUser)
      };
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    if (!userId) throw new UnauthorizedError('Chưa đăng nhập');
    
    if (!currentPassword || !newPassword) {
        throw new BadRequestError('Thiếu currentPassword hoặc newPassword');
      }
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự');
      }
      if (newPassword === currentPassword) {
        throw new BadRequestError('Mật khẩu mới không được trùng mật khẩu hiện tại');
      }
    
      const user = await UserRepository.findById(userId);
      if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');
    
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) throw new UnauthorizedError('Mật khẩu hiện tại không đúng');
    
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(newPassword, salt);
    
      await UserRepository.update(userId, { password: hashed, refresh_token: null });
    
      return {
        message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại để tiếp tục.'
      };
  }

  async uploadAvatar(userId, file) {
    if (!userId) throw new UnauthorizedError('Chưa đăng nhập');
    if (!file) throw new BadRequestError('Không có file được tải lên');

    const user = await UserRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Không tìm thấy người dùng');

    try {
        const old = user.avatar;
        if (old && /^\/?uploads\/avatar\//.test(old)) {
          const oldPath = path.join(process.cwd(), old.replace(/^\//, ''));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
    } catch (e) {
        console.error('Remove old avatar failed:', e?.message || e);
    }

    const storedPath = `/uploads/avatar/${file.filename}`;
    await UserRepository.update(userId, { avatar: storedPath });
    
    // Fetch updated to return
    const updatedUser = await UserRepository.findById(userId);

    return {
        message: 'Tải lên avatar thành công',
        user: this.getSafeUser(updatedUser),
    };
  }

  computeIsVip(user) {
    return !!user?.vip_expires_at && new Date(user.vip_expires_at) > new Date();
  }

  getSafeUser(user) {
      const userJson = user.toJSON ? user.toJSON() : user;
      const { password, refresh_token, ...safeUser } = userJson;
      return safeUser;
  }
}

module.exports = new AuthService();
