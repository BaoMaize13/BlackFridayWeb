const assert = require("node:assert/strict");
const { test } = require("node:test");

const { generateLockToken } = require("../../src/utils/lock-token.util");

test("generateLockToken returns a non-empty string", () => {
  const token = generateLockToken({
    requestId: "req-lock-token-001",
    serverId: "server-lock-token"
  });

  assert.equal(typeof token, "string");
  assert.equal(token.length > 0, true);
  assert.equal(token.startsWith("server-lock-token:req-lock-token-001:"), true);
});

test("generateLockToken returns unique values across repeated calls", () => {
  const firstToken = generateLockToken({
    requestId: "req-lock-token-002",
    serverId: "server-lock-token"
  });
  const secondToken = generateLockToken({
    requestId: "req-lock-token-002",
    serverId: "server-lock-token"
  });

  assert.notEqual(firstToken, secondToken);
});
