const logger = require('./logger');

// Global error handler middleware for Express
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Internal Server Error';
  
  // Log the error
  logger.error(`${statusCode} - ${errorMessage}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });
  
  // Send response to client
  res.status(statusCode).json({
    error: {
      message: errorMessage,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
}

// Custom API error class
class ApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
  
  static badRequest(message, code = 'BAD_REQUEST') {
    return new ApiError(message, 400, code);
  }
  
  static notFound(message, code = 'NOT_FOUND') {
    return new ApiError(message, 404, code);
  }
  
  static internal(message, code = 'INTERNAL_ERROR') {
    return new ApiError(message, 500, code);
  }
}

module.exports = {
  errorHandler,
  ApiError
};