const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");

class AppError extends Error {
  constructor({
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    details,
    exposeMessage = statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isOperational = statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR
  }) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.exposeMessage = exposeMessage;
    this.isOperational = isOperational;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = AppError;
