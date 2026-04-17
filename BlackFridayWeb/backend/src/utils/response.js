const { ERROR_CODES, HTTP_STATUS, RESPONSE_MESSAGES } = require("../constants/system");

function getRequestId(req) {
  return req.context?.requestId || req.id || null;
}

function buildMeta(req, meta = {}) {
  return {
    requestId: getRequestId(req),
    timestamp: new Date().toISOString(),
    ...meta
  };
}

function sendSuccess(res, req, options = {}) {
  const {
    statusCode = HTTP_STATUS.OK,
    message = RESPONSE_MESSAGES.SUCCESS.DEFAULT,
    data = null,
    meta
  } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: buildMeta(req, meta)
  });
}

function sendFail(res, req, options = {}) {
  const {
    statusCode = HTTP_STATUS.BAD_REQUEST,
    message = RESPONSE_MESSAGES.ERROR.DEFAULT,
    errorCode = ERROR_CODES.BAD_REQUEST,
    details,
    meta,
    debug
  } = options;

  const payload = {
    success: false,
    message,
    error: {
      code: errorCode
    },
    meta: buildMeta(req, meta)
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  if (debug !== undefined) {
    payload.error.debug = debug;
  }

  return res.status(statusCode).json(payload);
}

function sendError(res, req, options = {}) {
  const {
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message = RESPONSE_MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details,
    meta,
    debug
  } = options;

  return sendFail(res, req, {
    statusCode,
    message,
    errorCode,
    details,
    meta,
    debug
  });
}

module.exports = {
  sendError,
  sendFail,
  sendSuccess
};
