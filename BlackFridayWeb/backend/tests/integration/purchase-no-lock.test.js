const assert = require("node:assert/strict");

const request = require("supertest");

const { ORDER_FAILURE_REASONS, ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../../src/constants/domain");
const { createApp } = require("../../src/app");
const { closeDatabase, initializeDatabase, runMigrations } = require("../../src/database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { resetTestData } = require("../../src/scripts/reset-data");

const app = createApp();

async function ensureDatabaseReady() {
  await initializeDatabase();
  await runMigrations();
}

async function testPurchaseWithoutLockSuccess() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  const response = await request(app)
    .post("/purchase/no-lock")
    .set("x-request-id", "http-purchase-no-lock-success")
    .send({
      productId: product.id,
      quantity: 1,
      requestId: "purchase-no-lock-success-001",
      userId: "user-001"
    })
    .expect(200);

  const updatedProduct = await productRepository.findProductById(product.id);
  const order = await orderRepository.findOrderByRequestId("purchase-no-lock-success-001");
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-success-001");
  const attemptActions = attemptLogs.map((attemptLog) => attemptLog.action);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.requestId, "purchase-no-lock-success-001");
  assert.equal(response.body.data.stockBefore, 1);
  assert.equal(response.body.data.stockAfter, 0);
  assert.equal(response.body.data.delayMs, 5);
  assert.equal(updatedProduct.stock, 0);
  assert.equal(order.status, ORDER_STATUSES.SUCCESS);
  assert.deepEqual(attemptActions, [
    PURCHASE_LOG_ACTIONS.PURCHASE_REQUEST_RECEIVED,
    PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_STARTED,
    PURCHASE_LOG_ACTIONS.PRODUCT_READ,
    PURCHASE_LOG_ACTIONS.STOCK_READ,
    PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED,
    PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_STARTED,
    PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_ENDED,
    PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
    PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS
  ]);
}

async function testPurchaseWithoutLockOutOfStock() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await productRepository.resetProductStock(product.id, 0, {
    version: 0
  });

  const response = await request(app)
    .post("/purchase/no-lock")
    .send({
      productId: product.id,
      quantity: 1,
      requestId: "purchase-no-lock-out-of-stock-001",
      userId: "user-002"
    })
    .expect(409);

  const failedOrder = await orderRepository.findOrderByRequestId("purchase-no-lock-out-of-stock-001");
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-out-of-stock-001");
  const attemptActions = attemptLogs.map((attemptLog) => attemptLog.action);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "OUT_OF_STOCK");
  assert.equal(failedOrder.status, ORDER_STATUSES.FAILED);
  assert.equal(failedOrder.failureReason, ORDER_FAILURE_REASONS.OUT_OF_STOCK);
  assert.equal(attemptActions.includes(PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED), true);
  assert.equal(attemptActions.includes(PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED), true);
}

async function testPurchaseWithoutLockProductNotFound() {
  await resetTestData();

  const purchaseAttemptRepository = new PurchaseAttemptRepository();

  const response = await request(app)
    .post("/purchase/no-lock")
    .send({
      productId: 999999,
      quantity: 1,
      requestId: "purchase-no-lock-product-not-found-001",
      userId: "user-003"
    })
    .expect(404);

  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-product-not-found-001");

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "PRODUCT_NOT_FOUND");
  assert.equal(attemptLogs.length, 3);
  assert.equal(attemptLogs[0].productId, null);
  assert.equal(attemptLogs[2].action, PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED);
}

async function testPurchaseWithoutLockDuplicateRequest() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  await request(app)
    .post("/purchase/no-lock")
    .send({
      productId: product.id,
      quantity: 1,
      requestId: "purchase-no-lock-duplicate-001",
      userId: "user-004"
    })
    .expect(200);

  const duplicateResponse = await request(app)
    .post("/purchase/no-lock")
    .send({
      productId: product.id,
      quantity: 1,
      requestId: "purchase-no-lock-duplicate-001",
      userId: "user-004"
    })
    .expect(409);

  const orders = await orderRepository.listOrders({
    requestId: "purchase-no-lock-duplicate-001"
  });
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-duplicate-001");

  assert.equal(duplicateResponse.body.error.code, "DUPLICATE_REQUEST");
  assert.equal(orders.length, 1);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED),
    true
  );
}

async function runPurchaseNoLockIntegrationTests() {
  const testCases = [
    ["No-lock purchase API completes a single success request and records full audit trail", testPurchaseWithoutLockSuccess],
    ["No-lock purchase API returns out-of-stock and creates a failed order", testPurchaseWithoutLockOutOfStock],
    ["No-lock purchase API returns product-not-found and still records audit logs", testPurchaseWithoutLockProductNotFound],
    ["No-lock purchase API rejects duplicate request ids", testPurchaseWithoutLockDuplicateRequest]
  ];

  await ensureDatabaseReady();

  try {
    for (const [name, testCase] of testCases) {
      await testCase();
      console.log(`PASS ${name}`);
    }
  } finally {
    await closeDatabase();
  }
}

module.exports = {
  runPurchaseNoLockIntegrationTests
};
