const pino = require("pino");

const { appConfig, logConfig, serverConfig } = require("../config");

function buildTransport() {
  if (!appConfig.isDevelopment || !logConfig.prettyPrint) {
    return undefined;
  }

  return {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:standard"
    }
  };
}

const loggerOptions = {
  level: logConfig.level,
  messageKey: "message",
  name: appConfig.name,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    appName: appConfig.name,
    environment: appConfig.env,
    serverId: serverConfig.id
  },
  formatters: {
    bindings() {
      return {};
    },
    level(label) {
      return { level: label };
    }
  },
  redact: {
    paths: logConfig.redactPaths,
    censor: "[redacted]"
  }
};

const transport = buildTransport();

if (transport) {
  loggerOptions.transport = transport;
}

const logger = pino(loggerOptions);

function createLogger(bindings = {}) {
  return Object.keys(bindings).length > 0 ? logger.child(bindings) : logger;
}

module.exports = {
  createLogger,
  logger
};
