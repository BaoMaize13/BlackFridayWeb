const { lockConfig } = require("../../src/config");
const { disconnectRedis, getRedisClient } = require("../../src/config/redis");
const {
  buildRedisRequiredFailureMessage,
  buildRedisUnavailableMessage,
  checkRedisAvailability,
  isRedisRequiredForTestRun,
  resetRedisAvailabilityCache
} = require("../helpers/redis-availability.helper");

async function isRedisAvailable() {
  const result = await checkRedisAvailability();
  return result.available;
}

async function ensureRedisAvailable(testContext) {
  const result = await checkRedisAvailability();

  if (!result.available) {
    if (isRedisRequiredForTestRun()) {
      throw new Error(buildRedisRequiredFailureMessage(result.reason));
    }

    testContext.skip(buildRedisUnavailableMessage(result.reason));
    return false;
  }

  return true;
}

async function cleanupTestRedisKeys() {
  const available = await isRedisAvailable();

  if (!available) {
    return;
  }

  const client = getRedisClient();
  const keys = await client.keys(`${lockConfig.keyPrefix}:*`);

  if (keys.length > 0) {
    await client.del(keys);
  }
}

async function closeTestRedis() {
  resetRedisAvailabilityCache();
  await disconnectRedis().catch(() => null);
}

module.exports = {
  cleanupTestRedisKeys,
  closeTestRedis,
  ensureRedisAvailable,
  isRedisAvailable
};
