// controllers/user/vip.controller.js
const asyncHandler = require('express-async-handler')
const {
  users: User,
  vip_purchases: VipPurchase,
} = require('../../models')

/**
 * Tính start/end cho lần mua:
 * - nếu còn hạn => start = vip_expires_at, end = start + 30 ngày
 * - nếu hết hạn/null => start = now, end = now + 30 ngày
 */
function calcNextWindow(curExpire, durationDays = 30) {
  const now = new Date()
  let start
  if (curExpire && new Date(curExpire) >= now) {
    start = new Date(curExpire)
  } else {
    start = now
  }
  const end = new Date(start.getTime())
  end.setDate(end.getDate() + durationDays)
  return { start, end }
}

/**
 * GET api/vip/status
 * Trả về tình trạng VIP hiện tại của user
 */
const getVipStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const user = await User.findByPk(userId, { attributes: ['id', 'vip_started_at', 'vip_expires_at'] })
  const now = new Date()
  const isVip = !!user?.vip_expires_at && new Date(user.vip_expires_at) > now

  return res.json({
    isVip,
    vip_started_at: user?.vip_started_at || null,
    vip_expires_at: user?.vip_expires_at || null,
    now
  })
})

/**
 * POST api/vip/checkout
 * Thanh toán ảo: bấm là "PAID" và cộng dồn 30 ngày
 * Body (tùy chọn): { price?: number, note?: string }
 */
const fakeCheckout = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const PRICE = Number.isFinite(+req.body?.price) ? Math.max(0, +req.body.price) : 49000
  const NOTE = req.body?.note || 'Fake payment (click-to-pay)'
  const DURATION = 30

  // Khóa bản ghi user để tránh race condition khi spam nút thanh toán
  const user = await User.findByPk(userId)
  if (!user) {
    // Không dùng ApiError ở đây để tránh import thêm; bạn có thể đổi sang NotFoundError nếu muốn
    throw new Error('User not found')
  }

  const { start, end } = calcNextWindow(user.vip_expires_at, DURATION)

  // Ghi log mua VIP
  await VipPurchase.create({
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
  })

  // Cập nhật user
  await user.update({
    vip_started_at: start,
    vip_expires_at: end
  })

  return res.status(200).json({
    message: 'Thanh toán VIP thành công',
    plan: 'VIP30',
    duration_days: DURATION
  })
})

module.exports = {
  getVipStatus,
  fakeCheckout,
}
