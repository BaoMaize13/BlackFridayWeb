const assert = require("node:assert/strict");
const { after, afterEach, test } = require("node:test");

const { LOCK_RELEASE_REASONS } = require("../../src/constants/lock.constants");
const { ERROR_CODES } = require("../../src/constants/system");
const lockService = require("../../src/services/lock.service");
const { buildProductLockKey } = require("../../src/utils/lock-key.util");
const { cleanupTestRedisKeys, closeTestRedis, ensureRedisAvailable } = require("../setup/test-redis");

function createLockKey(caseName) {
  return buildProductLockKey(`phase13-lock-service-${Date.now()}-${caseName}`);
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

afterEach(async () => {
  await cleanupTestRedisKeys();
});

after(async () => {
  await closeTestRedis();
});

test("lock service acquires and releases a lock normally", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("acquire-release");
  const lock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-acquire-release",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
  const releaseResult = await lockService.releaseLock(lockKey, lock.token, {
    requestId: "lock-service-acquire-release",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(lock.acquired, true);
  assert.equal(typeof lock.token, "string");
  assert.equal(releaseResult.released, true);
});

test("lock service times out when the same lock key is already held", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("timeout");
  const primaryLock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-timeout-primary",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  try {
    await assert.rejects(
      () =>
        lockService.acquireLock(lockKey, {
          requestId: "lock-service-timeout-secondary",
          retryIntervalMs: 25,
          ttlMs: 1000,
          waitTimeoutMs: 150
        }),
      (error) => {
        assert.equal(error.errorCode, ERROR_CODES.LOCK_TIMEOUT);
        return true;
      }
    );
  } finally {
    await lockService.releaseLock(lockKey, primaryLock.token, {
      requestId: "lock-service-timeout-cleanup",
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 250
    });
  }
});

test("lock service does not release a lock when token mismatches", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("wrong-token");
  const lock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-wrong-token",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  const wrongReleaseResult = await lockService.releaseLock(lockKey, "wrong-token", {
    requestId: "lock-service-wrong-token",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(wrongReleaseResult.released, false);
  assert.equal(wrongReleaseResult.reason, LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED);

  const properReleaseResult = await lockService.releaseLock(lockKey, lock.token, {
    requestId: "lock-service-wrong-token-cleanup",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(properReleaseResult.released, true);
});

test("lock service allows reacquire after TTL expiry", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("ttl-expiry");
  const firstLock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-ttl-first",
    retryIntervalMs: 25,
    ttlMs: 150,
    waitTimeoutMs: 250
  });

  await sleep(250);

  const secondLock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-ttl-second",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
  const staleReleaseResult = await lockService.releaseLock(lockKey, firstLock.token, {
    requestId: "lock-service-ttl-stale-release",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(firstLock.acquired, true);
  assert.equal(secondLock.acquired, true);
  assert.notEqual(firstLock.token, secondLock.token);
  assert.equal(staleReleaseResult.released, false);
  assert.equal(staleReleaseResult.reason, LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED);

  await lockService.releaseLock(lockKey, secondLock.token, {
    requestId: "lock-service-ttl-cleanup",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
});

test("withLock releases the lock when handler succeeds", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("with-lock-success");
  const result = await lockService.withLock(
    lockKey,
    async () => "handler-success",
    {
      requestId: "lock-service-with-lock-success",
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 250
    }
  );

  const reacquiredLock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-with-lock-success-reacquire",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(result, "handler-success");
  assert.equal(reacquiredLock.acquired, true);

  await lockService.releaseLock(lockKey, reacquiredLock.token, {
    requestId: "lock-service-with-lock-success-cleanup",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
});

test("withLock releases the lock and rethrows the original handler error", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const lockKey = createLockKey("with-lock-throw");

  await assert.rejects(
    () =>
      lockService.withLock(
        lockKey,
        async () => {
          throw new Error("handler failed");
        },
        {
          requestId: "lock-service-with-lock-throw",
          retryIntervalMs: 25,
          ttlMs: 1000,
          waitTimeoutMs: 250
        }
      ),
    /handler failed/
  );

  const reacquiredLock = await lockService.acquireLock(lockKey, {
    requestId: "lock-service-with-lock-throw-reacquire",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(reacquiredLock.acquired, true);

  await lockService.releaseLock(lockKey, reacquiredLock.token, {
    requestId: "lock-service-with-lock-throw-cleanup",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
});
