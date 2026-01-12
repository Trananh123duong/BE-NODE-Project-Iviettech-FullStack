const BaseRepository = require('./base.repository');
const { vip_purchases: VipPurchase, users: User } = require('../models');

class VipRepository extends BaseRepository {
  constructor() {
    super(VipPurchase);
  }

  async updateUserVip(userId, { vip_started_at, vip_expires_at }) {
    return await User.update(
        { vip_started_at, vip_expires_at },
        { where: { id: userId } }
    );
  }

  // User methods related to VIP can be here or in UserRepository. 
  // Since we have a UserRepository, maybe fetch user status there? 
  // But strictly Vip module, let's keep VIP specific queries here or use generic BaseRepo on Purchase.
  // Actually, checking "isVip" relies on user table.
}

module.exports = new VipRepository();
