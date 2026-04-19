const { connectRedis, disconnectRedis, getRedisClient } = require("../../src/config/redis");

let redisAvailabilityPromise = null;
let redisAvailableLogPrinted = false;
let redisUnavailableLogPrinted = false;
let lastAvailabilityResult = {
  available: false,
  reason: "Redis availability has not been checked yet."
};

function isRedisRequiredForTestRun() {
  return String(process.env.REQUIRE_REDIS_TESTS || "false").trim().toLowerCase() === "true";
}

function buildRedisUnavailableMessage(reason) {
  return `Redis is not available at ${process.env.REDIS_URL}. Redis-dependent tests were skipped. Reason: ${reason}`;
}

function buildRedisRequiredFailureMessage(reason) {
  return `Redis is required for this test run but is unavailable. REDIS_URL=${process.env.REDIS_URL}. Reason: ${reason}`;
}

async function checkRedisAvailability() {
  if (!redisAvailabilityPromise) {
    redisAvailabilityPromise = (async () => {
      try {
        await connectRedis();
        const client = getRedisClient();
        const pingResult = await client.ping();

        if (pingResult !== "PONG") {
          throw new Error(`Unexpected Redis ping response: ${pingResult}`);
        }

        lastAvailabilityResult = {
          available: true,
          reason: null
        };

        if (!redisAvailableLogPrinted) {
          console.info(`Redis available at ${process.env.REDIS_URL}. Running Redis-dependent tests.`);
          redisAvailableLogPrinted = true;
        }

        return lastAvailabilityResult;
      } catch (error) {
        lastAvailabilityResult = {
          available: false,
          reason: error.message
        };

        await disconnectRedis().catch(() => null);

        if (!redisUnavailableLogPrinted) {
          console.warn(buildRedisUnavailableMessage(error.message));
          redisUnavailableLogPrinted = true;
        }

        return lastAvailabilityResult;
      }
    })();
  }

  return redisAvailabilityPromise;
}

function resetRedisAvailabilityCache() {
  redisAvailabilityPromise = null;
  redisAvailableLogPrinted = false;
  redisUnavailableLogPrinted = false;
  lastAvailabilityResult = {
    available: false,
    reason: "Redis availability has not been checked yet."
  };
}

module.exports = {
  buildRedisRequiredFailureMessage,
  buildRedisUnavailableMessage,
  checkRedisAvailability,
  isRedisRequiredForTestRun,
  resetRedisAvailabilityCache
};
