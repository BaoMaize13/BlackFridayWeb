const { lockConfig } = require("../config");
const { connectRedis, getRedisClient } = require("../config/redis");
const { LOCK_EVENTS, LOCK_RELEASE_REASONS } = require("../constants/lock.constants");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");
const { generateLockToken } = require("../utils/lock-token.util");
const { logger } = require("../utils/logger");
const { sleep } = require("../utils/sleep.util");

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

const lockMetrics = {
  acquireAttempts: 0,
  acquired: 0,
  releaseFailed: 0,
  releaseSkipped: 0,
  released: 0,
  retries: 0,
  timeouts: 0,
  totalWaitMs: 0,
  unavailable: 0
};

function maskToken(token) {
  if (!token) {
    return null;
  }

  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function cloneLockMetrics() {
  const averageWaitMs =
    lockMetrics.acquired > 0 ? Number((lockMetrics.totalWaitMs / lockMetrics.acquired).toFixed(2)) : 0;

  return {
    ...lockMetrics,
    averageWaitMs
  };
}

function resolveLogger(options = {}) {
  return options.logger || logger;
}

function normalizePositiveInteger(value, fallbackValue, fieldName) {
  const resolvedValue = value ?? fallbackValue;

  if (!Number.isInteger(resolvedValue) || resolvedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return resolvedValue;
}

function resolveLockOptions(options = {}) {
  return {
    metadata: options.metadata || {},
    requestId: options.requestId || null,
    retryIntervalMs: normalizePositiveInteger(
      options.retryIntervalMs,
      lockConfig.retryIntervalMs,
      "retryIntervalMs"
    ),
    serverId: options.serverId,
    token: options.token,
    ttlMs: normalizePositiveInteger(options.ttlMs, lockConfig.ttlMs, "ttlMs"),
    waitTimeoutMs: normalizePositiveInteger(
      options.waitTimeoutMs,
      lockConfig.waitTimeoutMs,
      "waitTimeoutMs"
    )
  };
}

function buildLogContext(lockKey, resolvedOptions, extraFields = {}) {
  return {
    lockKey,
    requestId: resolvedOptions.requestId,
    retryIntervalMs: resolvedOptions.retryIntervalMs,
    ttlMs: resolvedOptions.ttlMs,
    waitTimeoutMs: resolvedOptions.waitTimeoutMs,
    ...resolvedOptions.metadata,
    ...extraFields
  };
}

function createLockTimeoutError(lockKey, details) {
  return new AppError({
    message: `Failed to acquire lock '${lockKey}' within ${details.waitTimeoutMs}ms`,
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.LOCK_TIMEOUT,
    details
  });
}

function createLockServiceUnavailableError(lockKey, error, resolvedOptions) {
  return new AppError({
    message: `Redis lock service is unavailable for '${lockKey}'`,
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
    errorCode: ERROR_CODES.LOCK_SERVICE_UNAVAILABLE,
    details: {
      lockKey,
      requestId: resolvedOptions.requestId,
      reason: error.message
    },
    exposeMessage: true,
    isOperational: true
  });
}

function createLockReleaseError(lockKey, error, resolvedOptions) {
  return new AppError({
    message: `Failed to release lock '${lockKey}'`,
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.LOCK_RELEASE_FAILED,
    details: {
      lockKey,
      reason: LOCK_RELEASE_REASONS.REDIS_ERROR,
      requestId: resolvedOptions.requestId,
      redisMessage: error.message
    },
    exposeMessage: true,
    isOperational: true
  });
}

async function getConnectedRedisClient(lockKey, resolvedOptions, activeLogger, operationName) {
  try {
    await connectRedis();
    return getRedisClient();
  } catch (error) {
    activeLogger.error(
      buildLogContext(lockKey, resolvedOptions, {
        operationName,
        err: error
      }),
      "Redis connection failed for lock operation"
    );

    throw createLockServiceUnavailableError(lockKey, error, resolvedOptions);
  }
}

class LockService {
  async acquireLock(lockKey, options = {}) {
    const activeLogger = resolveLogger(options);
    const resolvedOptions = resolveLockOptions(options);
    const token =
      resolvedOptions.token ||
      generateLockToken({
        requestId: resolvedOptions.requestId,
        serverId: resolvedOptions.serverId
      });
    const client = await getConnectedRedisClient(lockKey, resolvedOptions, activeLogger, "acquireLock");
    const startedAtMs = Date.now();
    let attemptCount = 0;

    activeLogger.info(
      buildLogContext(lockKey, resolvedOptions, {
        action: LOCK_EVENTS.LOCK_ACQUIRE_STARTED
      }),
      "Lock acquisition started"
    );

    while (true) {
      attemptCount += 1;
      lockMetrics.acquireAttempts += 1;

      let setResult;

      try {
        setResult = await client.set(lockKey, token, {
          NX: true,
          PX: resolvedOptions.ttlMs
        });
      } catch (error) {
        lockMetrics.unavailable += 1;
        activeLogger.error(
          buildLogContext(lockKey, resolvedOptions, {
            attemptCount,
            operationName: "acquireLock",
            err: error
          }),
          "Redis error occurred during lock acquisition"
        );

        throw createLockServiceUnavailableError(lockKey, error, resolvedOptions);
      }

      if (setResult === "OK") {
        const elapsedMs = Date.now() - startedAtMs;
        lockMetrics.acquired += 1;
        lockMetrics.totalWaitMs += elapsedMs;

        activeLogger.info(
          buildLogContext(lockKey, resolvedOptions, {
            acquired: true,
            action: LOCK_EVENTS.LOCK_ACQUIRED,
            attempts: attemptCount,
            elapsedMs,
            token: maskToken(token)
          }),
          "Lock acquired"
        );

        return {
          acquired: true,
          attempts: attemptCount,
          elapsedMs,
          lockKey,
          token,
          ttlMs: resolvedOptions.ttlMs
        };
      }

      const elapsedMs = Date.now() - startedAtMs;

      if (elapsedMs >= resolvedOptions.waitTimeoutMs) {
        lockMetrics.timeouts += 1;
        activeLogger.warn(
          buildLogContext(lockKey, resolvedOptions, {
            acquired: false,
            action: LOCK_EVENTS.LOCK_ACQUIRE_TIMEOUT,
            attempts: attemptCount,
            elapsedMs
          }),
          "Lock acquisition timed out"
        );

        throw createLockTimeoutError(lockKey, {
          attempts: attemptCount,
          elapsedMs,
          lockKey,
          requestId: resolvedOptions.requestId,
          waitTimeoutMs: resolvedOptions.waitTimeoutMs
        });
      }

      activeLogger.info(
        buildLogContext(lockKey, resolvedOptions, {
          acquired: false,
          action: LOCK_EVENTS.LOCK_ACQUIRE_RETRY,
          attempts: attemptCount,
          elapsedMs
        }),
        "Lock acquisition retry scheduled"
      );

      lockMetrics.retries += 1;
      await sleep(Math.min(resolvedOptions.retryIntervalMs, resolvedOptions.waitTimeoutMs - elapsedMs));
    }
  }

  async releaseLock(lockKey, token, options = {}) {
    const activeLogger = resolveLogger(options);
    const resolvedOptions = resolveLockOptions(options);
    const client = await getConnectedRedisClient(lockKey, resolvedOptions, activeLogger, "releaseLock");

    activeLogger.info(
      buildLogContext(lockKey, resolvedOptions, {
        action: LOCK_EVENTS.LOCK_RELEASE_STARTED,
        token: maskToken(token)
      }),
      "Lock release started"
    );

    try {
      const releasedCount = Number(
        await client.eval(RELEASE_LOCK_SCRIPT, {
          keys: [lockKey],
          arguments: [token]
        })
      );

      if (releasedCount === 1) {
        lockMetrics.released += 1;
        activeLogger.info(
          buildLogContext(lockKey, resolvedOptions, {
            action: LOCK_EVENTS.LOCK_RELEASED,
            released: true,
            token: maskToken(token)
          }),
          "Lock released"
        );

        return {
          lockKey,
          reason: null,
          released: true
        };
      }

      activeLogger.warn(
        buildLogContext(lockKey, resolvedOptions, {
          action: LOCK_EVENTS.LOCK_RELEASE_SKIPPED,
          reason: LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED,
          released: false,
          token: maskToken(token)
        }),
        "Lock release skipped because token mismatched or lock already expired"
      );

      lockMetrics.releaseSkipped += 1;
      return {
        lockKey,
        reason: LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED,
        released: false
      };
    } catch (error) {
      lockMetrics.releaseFailed += 1;
      activeLogger.error(
        buildLogContext(lockKey, resolvedOptions, {
          action: LOCK_EVENTS.LOCK_RELEASE_FAILED,
          err: error,
          reason: LOCK_RELEASE_REASONS.REDIS_ERROR,
          token: maskToken(token)
        }),
        "Lock release failed"
      );

      throw createLockReleaseError(lockKey, error, resolvedOptions);
    }
  }

  async withLock(lockKey, handler, options = {}) {
    if (typeof handler !== "function") {
      throw new Error("handler must be a function");
    }

    const activeLogger = resolveLogger(options);
    const resolvedOptions = resolveLockOptions(options);
    const lock = await this.acquireLock(lockKey, {
      ...options,
      ...resolvedOptions
    });
    let handlerError = null;

    try {
      if (typeof options.onLockAcquired === "function") {
        options.onLockAcquired(lock);
      }

      return await handler(lock);
    } catch (error) {
      handlerError = error;
      throw error;
    } finally {
      try {
        const releaseResult = await this.releaseLock(lock.lockKey, lock.token, {
          ...options,
          ...resolvedOptions
        });

        if (typeof options.onLockReleased === "function") {
          options.onLockReleased(releaseResult);
        }
      } catch (releaseError) {
        activeLogger.warn(
          buildLogContext(lockKey, resolvedOptions, {
            action: LOCK_EVENTS.LOCK_RELEASE_FAILED,
            releaseErrorCode: releaseError.errorCode || ERROR_CODES.LOCK_RELEASE_FAILED
          }),
          "Lock release encountered an error inside withLock"
        );

        if (!handlerError) {
          throw releaseError;
        }
      }
    }
  }

  getMetrics() {
    return cloneLockMetrics();
  }
}

module.exports = new LockService();
