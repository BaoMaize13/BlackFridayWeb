const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");

const { serverConfig } = require("../config");
const { APP_HEADERS } = require("../constants/system");
const { createLogger } = require("../utils/logger");

function getIncomingRequestId(requestIdHeader) {
  if (Array.isArray(requestIdHeader)) {
    return requestIdHeader.find((value) => typeof value === "string" && value.trim()) || null;
  }

  if (typeof requestIdHeader === "string" && requestIdHeader.trim()) {
    return requestIdHeader.trim();
  }

  return null;
}

function requestContextMiddleware(req, res, next) {
  const requestId = getIncomingRequestId(req.headers[APP_HEADERS.REQUEST_ID]) || randomUUID();
  const requestPath = req.originalUrl || req.url;
  const requestLogger = createLogger({
    requestId,
    serverId: serverConfig.id
  });

  req.id = requestId;
  req.context = {
    logger: requestLogger,
    method: req.method,
    path: requestPath,
    requestId,
    serverId: serverConfig.id,
    startedAt: performance.now()
  };

  res.locals.requestContext = req.context;
  res.setHeader(APP_HEADERS.REQUEST_ID, requestId);

  next();
}

module.exports = requestContextMiddleware;
