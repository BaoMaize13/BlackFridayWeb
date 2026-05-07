const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");

const { ORDER_FAILURE_REASONS, ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../../src/constants/domain");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");
const { createPurchasePayload, getRequestClient } = require("../helpers/request.helper");

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("POST /api/purchase/no-lock succeeds for a single in-stock request", async () => {
  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  const response = await client
    .post("/api/purchase/no-lock")
    .set("x-request-id", "purchase-no-lock-success-001")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 1,
        requestId: "purchase-no-lock-success-001",
        userId: "user-001"
      })
    )
    .expect(200);

  const updatedProduct = await productRepository.findProductById(product.id);
  const order = await orderRepository.findOrderByRequestId("purchase-no-lock-success-001");
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-success-001");

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stockBefore, 1);
  assert.equal(response.body.data.stockAfter, 0);
  assert.equal(response.body.data.delayMs, 5);
  assert.equal(updatedProduct.stock, 0);
  assert.equal(order.status, ORDER_STATUSES.SUCCESS);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS),
    true
  );
});

test("POST /api/purchase/no-lock returns OUT_OF_STOCK when stock is zero", async () => {
  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await productRepository.resetProductStock(product.id, 0, {
    version: 0
  });

  const response = await client
    .post("/api/purchase/no-lock")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 1,
        requestId: "purchase-no-lock-out-of-stock-001",
        userId: "user-002"
      })
    )
    .expect(409);

  const failedOrder = await orderRepository.findOrderByRequestId("purchase-no-lock-out-of-stock-001");
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-out-of-stock-001");
  const reloadedProduct = await productRepository.findProductById(product.id);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "OUT_OF_STOCK");
  assert.equal(failedOrder.status, ORDER_STATUSES.FAILED);
  assert.equal(failedOrder.failureReason, ORDER_FAILURE_REASONS.OUT_OF_STOCK);
  assert.equal(reloadedProduct.stock, 0);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED),
    true
  );
});

test("POST /api/purchase/no-lock returns PRODUCT_NOT_FOUND for missing product", async () => {
  const client = getRequestClient();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();

  const response = await client
    .post("/api/purchase/no-lock")
    .send(
      createPurchasePayload({
        productId: 999999,
        quantity: 1,
        requestId: "purchase-no-lock-product-not-found-001",
        userId: "user-003"
      })
    )
    .expect(404);

  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-no-lock-product-not-found-001");

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "PRODUCT_NOT_FOUND");
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED),
    true
  );
});

test("POST /api/purchase/no-lock validates required fields and quantity", async () => {
  const client = getRequestClient();
  const invalidBodies = [
    {
      body: {
        quantity: 1,
        requestId: "purchase-no-lock-invalid-001",
        userId: "user-004"
      },
      expectedField: "productId"
    },
    {
      body: {
        productId: 1,
        quantity: 0,
        requestId: "purchase-no-lock-invalid-003",
        userId: "user-004"
      },
      expectedField: "quantity"
    }
  ];

  for (const invalidCase of invalidBodies) {
    const response = await client.post("/api/purchase/no-lock").send(invalidCase.body).expect(400);

    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.equal(
      response.body.error.details.some((detail) => detail.field === invalidCase.expectedField),
      true
    );
  }
});

test("POST /api/purchase/no-lock rejects duplicate requestId without creating a second success order", async () => {
  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");
  const payload = createPurchasePayload({
    productId: product.id,
    quantity: 1,
    requestId: "purchase-no-lock-duplicate-001",
    userId: "user-005"
  });

  await client.post("/api/purchase/no-lock").send(payload).expect(200);
  const duplicateResponse = await client.post("/api/purchase/no-lock").send(payload).expect(409);
  const orders = await orderRepository.listOrders({
    requestId: payload.requestId
  });

  assert.equal(duplicateResponse.body.error.code, "DUPLICATE_REQUEST");
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, ORDER_STATUSES.SUCCESS);
});
