const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");

function notFoundMiddleware(req, res, next) {
  next(
    new AppError({
      message: `Cannot ${req.method} ${req.originalUrl}`,
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.ROUTE_NOT_FOUND
    })
  );
}

module.exports = notFoundMiddleware;
