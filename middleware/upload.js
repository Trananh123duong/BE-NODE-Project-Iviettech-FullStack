const multer = require('multer')
const path = require('path')

const { BadRequestError } = require('../utils/ApiError')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + '-' + suffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/
    const mimetype = allowedTypes.test(file.mimetype)
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    )

    if (mimetype && extname) {
      return cb(null, true)
    }
    cb(new BadRequestError('Chỉ chấp nhận file hình ảnh (jpeg, jpg, png)'))
  },
})

module.exports = {
  upload,
}