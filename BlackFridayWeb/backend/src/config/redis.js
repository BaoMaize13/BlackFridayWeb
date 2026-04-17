const { redisConfig } = require("./index");

function getRedisState() {
  return {
    configured: Boolean(redisConfig.url),
    connected: false,
    driver: redisConfig.driver
  };
}

async function connectRedis() {
  return null;
}

async function disconnectRedis() {
  return null;
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisState,
  redisConfig
};
