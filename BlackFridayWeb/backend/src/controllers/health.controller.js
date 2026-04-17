const { appConfig, serverConfig } = require("../config");
const { HTTP_STATUS, RESPONSE_MESSAGES } = require("../constants/system");
const { getDatabaseState } = require("../database/client");
const { getRedisState } = require("../config/redis");
const { sendSuccess } = require("../utils/response");

function getHealth(req, res) {
  return sendSuccess(res, req, {
    statusCode: HTTP_STATUS.OK,
    message: RESPONSE_MESSAGES.SUCCESS.HEALTH_CHECK_OK,
    data: {
      status: "ok",
      appName: appConfig.name,
      environment: appConfig.env,
      server: {
        id: serverConfig.id,
        host: serverConfig.host,
        port: serverConfig.port
      },
      timestamp: new Date().toISOString(),
      services: {
        database: getDatabaseState(),
        redis: getRedisState()
      }
    }
  });
}

module.exports = {
  getHealth
};
