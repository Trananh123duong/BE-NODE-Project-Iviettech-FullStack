const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../utils/ApiError');

const isDev = process.env.NODE_ENV === 'development';
const APP_ROOT = process.cwd();

function pickFirstAppFrame(stack = '') {
  const lines = String(stack).split('\n').map(s => s.trim());
  for (const l of lines) {
    const m1 = l.match(/\((.*):(\d+):(\d+)\)/);
    const m2 = l.match(/at (.*):(\d+):(\d+)/);
    const m = m1 || m2;
    if (m) {
      const file = m1 ? m1[1] : m2[1];
      if (file.startsWith(APP_ROOT) && !file.includes('node_modules')) {
        const rel = path.relative(APP_ROOT, file);
        return { file: rel, line: Number(m[2]), column: Number(m[3]) };
      }
    }
  }
  return null;
}

function normalizeSequelize(err) {
  const base = {
    name: err.name,
    message: err.message,
  };

  if (Array.isArray(err.errors)) {
    base.validation = err.errors.map(e => ({
      message: e.message,
      path: e.path,
      value: e.value,
      type: e.type,
      validatorKey: e.validatorKey,
    }));
  }

  if (err.parent) {
    base.original = {
      code: err.parent.code,
      errno: err.parent.errno,
      sqlState: err.parent.sqlState,
    };
  }

  return base;
}

const errorHandler = (err, req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  let statusCode = 500;
  let body = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl || req.url,
  };

  if (err instanceof ApiError) {
    statusCode = err.statusCode || 500;
    body.error = {
      name: err.name || 'ApiError',
      message: err.message,
      details: err.details || undefined,
      cause: err.cause?.message || undefined,
    };
  }
  else if (err?.name === 'SequelizeValidationError' || err?.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    const norm = normalizeSequelize(err);
    body.error = {
      ...norm,
      message:
        norm.validation?.map(v => `${v.path}: ${v.message}`).join('; ') ||
        err.message,
    };
  }
  // JWT
  else if (err?.name === 'JsonWebTokenError') {
    statusCode = 401;
    body.error = { name: err.name, message: 'Token không hợp lệ' };
  } else if (err?.name === 'TokenExpiredError') {
    statusCode = 401;
    body.error = { name: err.name, message: 'Token đã hết hạn' };
  }
  // Mặc định
  else {
    body.error = {
      name: err?.name || 'InternalServerError',
      message: err?.message || 'Lỗi từ phía server',
    };
  }

  if (err?.stack) {
    const frame = pickFirstAppFrame(err.stack);
    if (frame) {
      body.error.location = frame; // { file, line, column }
    }
  }

  if (isDev && err?.stack) {
    body.error.stack = err.stack;
  }

  // LOG chi tiết (luôn log ở server, kể cả production)

  console.error(
    JSON.stringify(
      {
        level: 'error',
        requestId,
        statusCode,
        error: {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        },
        route: { method: req.method, url: req.originalUrl || req.url },
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      },
      null,
      2
    )
  );

  res.status(statusCode).json(body);
};

module.exports = errorHandler;
