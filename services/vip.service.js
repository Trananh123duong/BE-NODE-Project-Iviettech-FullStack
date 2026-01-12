const VipRepository = require('../repositories/vip.repository');
const UserRepository = require('../repositories/user.repository');
const { NotFoundError } = require('../utils/ApiError');

class VipService {
  async getVipStatus(userId) {
    const user = await UserRepository.findById(userId, { attributes: ['id', 'vip_started_at', 'vip_expires_at'] });
    const now = new Date();
    const isVip = !!user?.vip_expires_at && new Date(user.vip_expires_at) > now;

    return {
      isVip,
      vip_started_at: user?.vip_started_at || null,
      vip_expires_at: user?.vip_expires_at || null,
      now,
    };
  }

  calcNextWindow(curExpire, durationDays = 30) {
    const now = new Date();
    let start;
    if (curExpire && new Date(curExpire) >= now) {
      start = new Date(curExpire);
    } else {
      start = now;
    }
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + durationDays);
    return { start, end };
  }

  async fakeCheckout(userId, { price, note }) {
    const PRICE = Number.isFinite(+price) ? Math.max(0, +price) : 49000;
    const NOTE = note || 'Fake payment (click-to-pay)';
    const DURATION = 30;

    const user = await UserRepository.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const { start, end } = this.calcNextWindow(user.vip_expires_at, DURATION);

    await VipRepository.create({
        user_id: userId,
        plan_code: 'VIP30',
        duration_days: DURATION,
        price: PRICE,
        currency: 'VND',
        status: 'PAID',
        started_at: start,
        expires_at: end,
        note: NOTE,
        paid_at: new Date()
    });

    await VipRepository.updateUserVip(userId, {
        vip_started_at: start,
        vip_expires_at: end
    });

    return {
        message: 'Thanh toán VIP thành công',
        plan: 'VIP30',
        duration_days: DURATION
    };
  }
}

module.exports = new VipService();
