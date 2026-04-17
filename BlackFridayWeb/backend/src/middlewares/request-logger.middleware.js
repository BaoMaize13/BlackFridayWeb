const { performance } = require("node:perf_hooks");

const { logger } = require("../utils/logger");

function getLogLevel(statusCode) {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

function requestLoggerMiddleware(req, res, next) {
  const requestLogger = req.context?.logger || logger;
  const requestPath = req.originalUrl || req.url;

  requestLogger.info(
    {
      request: {
        method: req.method,
        path: requestPath
      }
    },
    "Incoming request"
  );

  let lifecycleLogged = false;

  function logRequestLifecycle(message, level) {
    if (lifecycleLogged) {
      return;
    }

    lifecycleLogged = true;

    const durationMs = req.context?.startedAt
      ? Number((performance.now() - req.context.startedAt).toFixed(2))
      : undefined;

    requestLogger[level](
      {
        request: {
          method: req.method,
          path: requestPath
        },
        response: {
          statusCode: res.statusCode
        },
        durationMs
      },
      message
    );
  }

  res.on("finish", () => {
    logRequestLifecycle("Request completed", getLogLevel(res.statusCode));
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      logRequestLifecycle("Request aborted", "warn");
    }
  });

  next();
}

module.exports = requestLoggerMiddleware;
