const express = require('express')
const router = express.Router()

const { verifyToken } = require('../../middleware/auth')
const historyCtrl = require('../../controllers/user/history.controller')

router.get('', verifyToken, historyCtrl.listMyHistory)
router.delete('/:id', verifyToken, historyCtrl.deleteMyHistoryItem)

module.exports = router
