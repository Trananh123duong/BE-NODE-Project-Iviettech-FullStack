class ApiError extends Error {
  constructor(statusCode, message) {
    super(message)

    this.statusCode = statusCode
  }
}

class BadRequestError extends ApiError {
  constructor(message = 'Yêu cầu không hợp lệ') {
    super(400, message)
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Xác thực không thành công') {
    super(401, message)
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'Không có quyền truy cập') {
    super(403, message)
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super(404, message)
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
}