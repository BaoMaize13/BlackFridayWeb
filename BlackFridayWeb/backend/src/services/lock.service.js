const { lockConfig } = require("../config");
const { connectRedis, getRedisClient } = require("../config/redis");
const { LOCK_EVENTS, LOCK_RELEASE_REASONS } = require("../constants/lock.constants");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");
const { generateLockToken } = require("../utils/lock-token.util");
const { logger } = require("../utils/logger");

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function maskToken(token) {
  if (!token) {
    return null;
  }

  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-4)}`;
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
        action: LOCK_EVENTS.ACQUIRE_STARTED
      }),
      "Lock acquisition started"
    );

    while (true) {
      attemptCount += 1;

      let setResult;

      try {
        setResult = await client.set(lockKey, token, {
          NX: true,
          PX: resolvedOptions.ttlMs
        });
      } catch (error) {
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

        activeLogger.info(
          buildLogContext(lockKey, resolvedOptions, {
            action: LOCK_EVENTS.ACQUIRED,
            attemptCount,
            elapsedMs,
            token: maskToken(token)
          }),
          "Lock acquired"
        );

        return {
          acquired: true,
          attemptCount,
          elapsedMs,
          lockKey,
          token,
          ttlMs: resolvedOptions.ttlMs
        };
      }

      const elapsedMs = Date.now() - startedAtMs;

      if (elapsedMs >= resolvedOptions.waitTimeoutMs) {
        activeLogger.warn(
          buildLogContext(lockKey, resolvedOptions, {
            action: LOCK_EVENTS.ACQUIRE_TIMEOUT,
            attemptCount,
            elapsedMs
          }),
          "Lock acquisition timed out"
        );

        throw createLockTimeoutError(lockKey, {
          attemptCount,
          elapsedMs,
          lockKey,
          requestId: resolvedOptions.requestId,
          waitTimeoutMs: resolvedOptions.waitTimeoutMs
        });
      }

      activeLogger.info(
        buildLogContext(lockKey, resolvedOptions, {
          action: LOCK_EVENTS.ACQUIRE_RETRY,
          attemptCount,
          elapsedMs
        }),
        "Lock acquisition retry scheduled"
      );

      await sleep(Math.min(resolvedOptions.retryIntervalMs, resolvedOptions.waitTimeoutMs - elapsedMs));
    }
  }

  async releaseLock(lockKey, token, options = {}) {
    const activeLogger = resolveLogger(options);
    const resolvedOptions = resolveLockOptions(options);
    const client = await getConnectedRedisClient(lockKey, resolvedOptions, activeLogger, "releaseLock");

    activeLogger.info(
      buildLogContext(lockKey, resolvedOptions, {
        action: LOCK_EVENTS.RELEASE_STARTED,
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
        activeLogger.info(
          buildLogContext(lockKey, resolvedOptions, {
            action: LOCK_EVENTS.RELEASED,
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
          action: LOCK_EVENTS.RELEASE_SKIPPED,
          reason: LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED,
          released: false,
          token: maskToken(token)
        }),
        "Lock release skipped because token mismatched or lock already expired"
      );

      return {
        lockKey,
        reason: LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED,
        released: false
      };
    } catch (error) {
      activeLogger.error(
        buildLogContext(lockKey, resolvedOptions, {
          action: LOCK_EVENTS.RELEASE_FAILED,
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
    let result;
    let handlerError = null;

    try {
      result = await handler(lock);
    } catch (error) {
      handlerError = error;
    }

    try {
      await this.releaseLock(lock.lockKey, lock.token, {
        ...options,
        ...resolvedOptions
      });
    } catch (releaseError) {
      activeLogger.warn(
        buildLogContext(lockKey, resolvedOptions, {
          action: LOCK_EVENTS.RELEASE_FAILED,
          releaseErrorCode: releaseError.errorCode || ERROR_CODES.LOCK_RELEASE_FAILED
        }),
        "Lock release encountered an error inside withLock"
      );

      if (!handlerError) {
        throw releaseError;
      }
    }

    if (handlerError) {
      throw handlerError;
    }

    return result;
  }
}

module.exports = new LockService();
