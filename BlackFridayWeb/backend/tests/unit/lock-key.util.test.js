const assert = require("node:assert/strict");
const { test } = require("node:test");

const { buildProductLockKey } = require("../../src/utils/lock-key.util");

test("buildProductLockKey returns the configured product-scoped lock key", () => {
  assert.equal(buildProductLockKey("abc123"), "test-lock:product:abc123");
  assert.equal(buildProductLockKey(42), "test-lock:product:42");
});

test("buildProductLockKey rejects empty productId", () => {
  assert.throws(
    () => buildProductLockKey(""),
    /productId is required to build product lock key/
  );
});
