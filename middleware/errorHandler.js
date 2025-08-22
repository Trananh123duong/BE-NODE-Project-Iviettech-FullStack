const { ApiError } = require('../utils/ApiError')

const errorHandler = (err, req, res, next) => {
  let statusCode = 500
  let message = 'Lỗi từ phía server'

  // Nếu lỗi là một instance của ApiError (lỗi do chúng ta chủ động tạo ra)
  if (err instanceof ApiError) {
    statusCode = err.statusCode
    message = err.message
  }

  // Xử lý các lỗi cụ thể khác (ví dụ: từ Sequelize)
  if (
    err.name === 'SequelizeValidationError' ||
    err.name === 'SequelizeUniqueConstraintError'
  ) {
    statusCode = 400 // Bad Request
    message = err.errors.map((e) => e.message).join(', ')
  }

  // Xử lý lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401 // Unauthorized
    message = 'Token không hợp lệ'
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token đã hết hạn'
  }

  const errorResponse = {
    message: message,
  }

  // Ghi log

  // Chỉ gửi stack trace về client nếu đang ở môi trường development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack
  }

  res.status(statusCode).json(errorResponse)
}

module.exports = errorHandler