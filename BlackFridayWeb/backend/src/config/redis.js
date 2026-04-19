const { redisConfig } = require("./index");
const { connectRedis, disconnectRedis, getRedisClient, getRedisState } = require("../database/redis.client");

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  getRedisState,
  redisConfig
};
