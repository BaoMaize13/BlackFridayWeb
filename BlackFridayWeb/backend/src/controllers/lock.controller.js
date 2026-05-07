const { lockConfig } = require("../config");
const { connectRedis, getRedisClient, getRedisState } = require("../config/redis");
const lockService = require("../services/lock.service");
const { buildProductLockKey } = require("../utils/lock-key.util");
const { sendSuccess } = require("../utils/response");

async function getLockEntries(productId) {
  await connectRedis();
  const client = getRedisClient();
  const pattern = productId ? buildProductLockKey(productId) : `${lockConfig.keyPrefix}:product:*`;
  const keys = await client.keys(pattern);

  return Promise.all(
    keys.map(async (key) => {
      const [token, ttlMs] = await Promise.all([client.get(key), client.pTTL(key)]);

      return {
        lockKey: key,
        token,
        ttlMs,
        status: token ? "ACTIVE" : "IDLE"
      };
    })
  );
}

async function getStatus(req, res) {
  let locks = [];
  let unavailableReason = null;

  try {
    locks = await getLockEntries(req.query.productId);
  } catch (error) {
    unavailableReason = error.message;
  }

  return sendSuccess(res, req, {
    message: "Lock status retrieved successfully",
    data: {
      locks,
      redis: getRedisState(),
      unavailableReason
    }
  });
}

async function getMetrics(req, res) {
  return sendSuccess(res, req, {
    message: "Lock metrics retrieved successfully",
    data: {
      metrics: lockService.getMetrics(),
      redis: getRedisState()
    }
  });
}

async function clearExpired(req, res) {
  return sendSuccess(res, req, {
    message: "Expired locks are cleared automatically by Redis TTL",
    data: {
      cleared: 0,
      note: "Redis removes expired lock keys automatically. Safe release still checks the owner token."
    }
  });
}

module.exports = {
  clearExpired,
  getMetrics,
  getStatus
};
