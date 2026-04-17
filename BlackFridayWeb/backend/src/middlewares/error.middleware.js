const { appConfig } = require("../config");
const { ERROR_CODES, HTTP_STATUS, RESPONSE_MESSAGES } = require("../constants/system");
const { logger } = require("../utils/logger");
const AppError = require("../utils/app-error");
const { sendError } = require("../utils/response");

function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError =
    error instanceof AppError
      ? error
      : new AppError({
          message: RESPONSE_MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
          exposeMessage: false,
          isOperational: false
        });

  const requestLogger = req.context?.logger || logger;
  const isServerError = normalizedError.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

  requestLogger[isServerError ? "error" : "warn"](
    {
      err: error,
      errorCode: normalizedError.errorCode,
      request: {
        method: req.method,
        path: req.originalUrl
      },
      statusCode: normalizedError.statusCode
    },
    "Request failed"
  );

  const responseMessage =
    isServerError && !appConfig.isDevelopment && !normalizedError.exposeMessage
      ? RESPONSE_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      : normalizedError.message;

  return sendError(res, req, {
    statusCode: normalizedError.statusCode,
    message: responseMessage,
    errorCode: normalizedError.errorCode,
    details: normalizedError.details,
    meta: {
      path: req.originalUrl
    },
    debug:
      appConfig.isDevelopment && isServerError
        ? {
            stack: error.stack
          }
        : undefined
  });
}

module.exports = errorMiddleware;
