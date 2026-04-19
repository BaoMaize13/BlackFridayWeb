const assert = require("node:assert/strict");

const { connectRedis, disconnectRedis, getRedisState } = require("../config/redis");
const { LOCK_RELEASE_REASONS } = require("../constants/lock.constants");
const { ERROR_CODES } = require("../constants/system");
const lockService = require("../services/lock.service");
const { buildProductLockKey } = require("../utils/lock-key.util");

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function createTestLockKey(runId, caseName) {
  return buildProductLockKey(`phase10-${runId}-${caseName}`);
}

async function runCase(caseLabel, handler) {
  try {
    await handler();
    console.log(`${caseLabel}: PASS`);
    return true;
  } catch (error) {
    console.log(`${caseLabel}: FAIL`);
    console.log(`  Reason: ${error.message}`);
    return false;
  }
}

async function testAcquireAndRelease(runId) {
  const lockKey = createTestLockKey(runId, "case-1");
  const lock = await lockService.acquireLock(lockKey, {
    requestId: `${runId}-case-1-acquire`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(lock.acquired, true);
  assert.equal(typeof lock.token, "string");

  const releaseResult = await lockService.releaseLock(lockKey, lock.token, {
    requestId: `${runId}-case-1-release`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(releaseResult.released, true);

  const withLockKey = createTestLockKey(runId, "case-1-with-lock");
  const handlerResult = await lockService.withLock(
    withLockKey,
    async () => "handler-ok",
    {
      requestId: `${runId}-case-1-with-lock`,
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 250
    }
  );

  assert.equal(handlerResult, "handler-ok");

  const reacquiredLock = await lockService.acquireLock(withLockKey, {
    requestId: `${runId}-case-1-reacquire`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(reacquiredLock.acquired, true);

  await lockService.releaseLock(withLockKey, reacquiredLock.token, {
    requestId: `${runId}-case-1-reacquire-release`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
}

async function testTimeoutWhenLocked(runId) {
  const lockKey = createTestLockKey(runId, "case-2");
  const primaryLock = await lockService.acquireLock(lockKey, {
    requestId: `${runId}-case-2-primary`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  try {
    await assert.rejects(
      () =>
        lockService.acquireLock(lockKey, {
          requestId: `${runId}-case-2-secondary`,
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
      requestId: `${runId}-case-2-cleanup`,
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 250
    });
  }
}

async function testWrongTokenRelease(runId) {
  const lockKey = createTestLockKey(runId, "case-3");
  const lock = await lockService.acquireLock(lockKey, {
    requestId: `${runId}-case-3-acquire`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  const wrongReleaseResult = await lockService.releaseLock(lockKey, "wrong-token", {
    requestId: `${runId}-case-3-wrong-release`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(wrongReleaseResult.released, false);
  assert.equal(wrongReleaseResult.reason, LOCK_RELEASE_REASONS.TOKEN_MISMATCH_OR_EXPIRED);

  const properReleaseResult = await lockService.releaseLock(lockKey, lock.token, {
    requestId: `${runId}-case-3-correct-release`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(properReleaseResult.released, true);
}

async function testTtlExpiry(runId) {
  const lockKey = createTestLockKey(runId, "case-4");
  const firstLock = await lockService.acquireLock(lockKey, {
    requestId: `${runId}-case-4-first`,
    retryIntervalMs: 25,
    ttlMs: 150,
    waitTimeoutMs: 250
  });

  assert.equal(firstLock.acquired, true);

  await sleep(250);

  const secondLock = await lockService.acquireLock(lockKey, {
    requestId: `${runId}-case-4-second`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(secondLock.acquired, true);
  assert.notEqual(secondLock.token, firstLock.token);

  const releaseResult = await lockService.releaseLock(lockKey, secondLock.token, {
    requestId: `${runId}-case-4-release`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(releaseResult.released, true);
}

async function runLockServiceTest() {
  const runId = Date.now();

  console.log("LOCK SERVICE TEST");
  console.log("-----------------");

  try {
    await connectRedis();
  } catch (error) {
    await disconnectRedis().catch(() => null);
    console.log(`Result: FAILED TO CONNECT TO REDIS`);
    console.log(`Reason: ${error.message}`);
    console.log(`Hint: start Redis at the configured REDIS_URL, then rerun npm run test:lock`);
    process.exit(1);
  }

  console.log(`Redis State: ${JSON.stringify(getRedisState())}`);

  const caseResults = [];
  caseResults.push(await runCase("Case 1 acquire/release", () => testAcquireAndRelease(runId)));
  caseResults.push(await runCase("Case 2 timeout when locked", () => testTimeoutWhenLocked(runId)));
  caseResults.push(await runCase("Case 3 wrong token release", () => testWrongTokenRelease(runId)));
  caseResults.push(await runCase("Case 4 TTL expiry", () => testTtlExpiry(runId)));

  await disconnectRedis();

  const allPassed = caseResults.every(Boolean);

  if (!allPassed) {
    console.log("Result: SOME CASES FAILED");
    process.exit(1);
  }

  console.log("Result: ALL PASS");
}

if (require.main === module) {
  runLockServiceTest().catch(async (error) => {
    await disconnectRedis().catch(() => null);
    console.error("LOCK SERVICE TEST FAILED");
    console.error("------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runLockServiceTest
};
