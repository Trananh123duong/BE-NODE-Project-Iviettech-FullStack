const router = require('express').Router()
const { verifyToken } = require('../../middleware/auth')
const vipCtrl = require('../../controllers/user/vip.controller')

// Xem trạng thái VIP hiện tại
router.get('/status', verifyToken, vipCtrl.getVipStatus)

// Thanh toán ảo (bấm là thành công)
router.post('/checkout', verifyToken, vipCtrl.fakeCheckout)

module.exports = router
