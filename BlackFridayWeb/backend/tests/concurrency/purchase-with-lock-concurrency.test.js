const assert = require("node:assert/strict");
const { after, afterEach, beforeEach, test } = require("node:test");

const { countOrdersByStatus } = require("../helpers/cleanup.helper");
const { createTestProduct } = require("../helpers/product.factory");
const { getProductStock } = require("../helpers/product.factory");
const { sendConcurrentPurchases } = require("../helpers/request.helper");
const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");
const { cleanupTestRedisKeys, closeTestRedis, ensureRedisAvailable } = require("../setup/test-redis");

beforeEach(async () => {
  await resetTestDatabase();
  await cleanupTestRedisKeys();
});

afterEach(async () => {
  await cleanupTestRedisKeys();
});

after(async () => {
  await closeTestDatabase();
  await closeTestRedis();
});

async function runWithLockConcurrencyCase(testContext, scenario) {
  if (!(await ensureRedisAvailable(testContext))) {
    return;
  }

  const product = await createTestProduct({
    price: 100000,
    stock: scenario.initialStock
  });

  const responses = await sendConcurrentPurchases({
    endpoint: "/purchase/with-lock",
    productId: product.id,
    quantity: scenario.quantity,
    requestPrefix: scenario.requestPrefix,
    requests: scenario.concurrentRequests,
    userPrefix: `${scenario.requestPrefix}-user`
  });

  const orderCounts = await countOrdersByStatus(product.id);
  const finalStock = await getProductStock(product.id);
  const successResponses = responses.filter((response) => response.body?.success === true);
  const maxSuccessOrders = Math.floor(scenario.initialStock / scenario.quantity);

  assert.equal(orderCounts.success, scenario.expectedSuccessOrders);
  assert.equal(finalStock, scenario.expectedFinalStock);
  assert.equal(finalStock >= 0, true);
  assert.equal(orderCounts.success <= maxSuccessOrders, true);
  assert.equal(finalStock, scenario.initialStock - orderCounts.success * scenario.quantity);
  assert.equal(successResponses.length, scenario.expectedSuccessOrders);
}

test("with-lock concurrency keeps consistency for stock=1, requests=10, quantity=1", async (t) => {
  await runWithLockConcurrencyCase(t, {
    concurrentRequests: 10,
    expectedFinalStock: 0,
    expectedSuccessOrders: 1,
    initialStock: 1,
    quantity: 1,
    requestPrefix: "with-lock-concurrency-001"
  });
});

test("with-lock concurrency keeps consistency for stock=1, requests=20, quantity=1", async (t) => {
  await runWithLockConcurrencyCase(t, {
    concurrentRequests: 20,
    expectedFinalStock: 0,
    expectedSuccessOrders: 1,
    initialStock: 1,
    quantity: 1,
    requestPrefix: "with-lock-concurrency-002"
  });
});

test("with-lock concurrency keeps consistency for stock=5, requests=20, quantity=1", async (t) => {
  await runWithLockConcurrencyCase(t, {
    concurrentRequests: 20,
    expectedFinalStock: 0,
    expectedSuccessOrders: 5,
    initialStock: 5,
    quantity: 1,
    requestPrefix: "with-lock-concurrency-003"
  });
});

test("with-lock concurrency keeps consistency for stock=5, requests=10, quantity=2", async (t) => {
  await runWithLockConcurrencyCase(t, {
    concurrentRequests: 10,
    expectedFinalStock: 1,
    expectedSuccessOrders: 2,
    initialStock: 5,
    quantity: 2,
    requestPrefix: "with-lock-concurrency-004"
  });
});
