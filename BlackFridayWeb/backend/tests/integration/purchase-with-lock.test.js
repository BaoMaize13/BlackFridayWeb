const assert = require("node:assert/strict");
const { after, afterEach, beforeEach, test } = require("node:test");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../../src/constants/domain");
const { ERROR_CODES, HTTP_STATUS } = require("../../src/constants/system");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const lockService = require("../../src/services/lock.service");
const AppError = require("../../src/utils/app-error");
const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");
const { createPurchasePayload, getRequestClient } = require("../helpers/request.helper");
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

test("POST /purchase/with-lock succeeds for a single in-stock request", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  const response = await client
    .post("/purchase/with-lock")
    .set("x-request-id", "purchase-with-lock-success-001")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 1,
        requestId: "purchase-with-lock-success-001",
        userId: "with-lock-user-001"
      })
    )
    .expect(200);

  const updatedProduct = await productRepository.findProductById(product.id);
  const order = await orderRepository.findOrderByRequestId("purchase-with-lock-success-001");
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-with-lock-success-001");

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stock.before, 1);
  assert.equal(response.body.data.stock.after, 0);
  assert.equal(response.body.data.isDuplicate, false);
  assert.equal(updatedProduct.stock, 0);
  assert.equal(order.status, ORDER_STATUSES.SUCCESS);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_SUCCESS),
    true
  );
});

test("POST /purchase/with-lock returns OUT_OF_STOCK and keeps stock unchanged", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await productRepository.resetProductStock(product.id, 0, {
    version: 0
  });

  const response = await client
    .post("/purchase/with-lock")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 1,
        requestId: "purchase-with-lock-out-of-stock-001",
        userId: "with-lock-user-002"
      })
    )
    .expect(409);

  const failedOrder = await orderRepository.findOrderByRequestId("purchase-with-lock-out-of-stock-001");
  const reloadedProduct = await productRepository.findProductById(product.id);
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-with-lock-out-of-stock-001");

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, ERROR_CODES.OUT_OF_STOCK);
  assert.equal(failedOrder.status, ORDER_STATUSES.FAILED);
  assert.equal(reloadedProduct.stock, 0);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED_WITH_LOCK),
    true
  );
});

test("POST /purchase/with-lock returns PRODUCT_NOT_FOUND for missing product", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();

  const response = await client
    .post("/purchase/with-lock")
    .send(
      createPurchasePayload({
        productId: 999999,
        quantity: 1,
        requestId: "purchase-with-lock-product-not-found-001",
        userId: "with-lock-user-003"
      })
    )
    .expect(404);

  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId("purchase-with-lock-product-not-found-001");

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, ERROR_CODES.PRODUCT_NOT_FOUND);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED),
    true
  );
});

test("POST /purchase/with-lock validates required fields and quantity", async () => {
  const client = getRequestClient();
  const invalidBodies = [
    {
      body: {
        quantity: 1,
        requestId: "purchase-with-lock-invalid-001",
        userId: "with-lock-user-004"
      },
      expectedField: "productId"
    },
    {
      body: {
        productId: 1,
        quantity: 1,
        userId: "with-lock-user-004"
      },
      expectedField: "requestId"
    },
    {
      body: {
        productId: 1,
        quantity: 0,
        requestId: "purchase-with-lock-invalid-003",
        userId: "with-lock-user-004"
      },
      expectedField: "quantity"
    }
  ];

  for (const invalidCase of invalidBodies) {
    const response = await client.post("/purchase/with-lock").send(invalidCase.body).expect(422);

    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.equal(
      response.body.error.details.some((detail) => detail.field === invalidCase.expectedField),
      true
    );
  }
});

test("POST /purchase/with-lock returns existing order for duplicate requestId without reducing stock twice", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");
  const payload = createPurchasePayload({
    productId: product.id,
    quantity: 1,
    requestId: "purchase-with-lock-duplicate-001",
    userId: "with-lock-user-005"
  });

  const firstResponse = await client.post("/purchase/with-lock").send(payload).expect(200);
  const duplicateResponse = await client.post("/purchase/with-lock").send(payload).expect(200);
  const reloadedProduct = await productRepository.findProductById(product.id);
  const orders = await orderRepository.listOrders({
    requestId: payload.requestId
  });
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId(payload.requestId);

  assert.equal(firstResponse.body.data.isDuplicate, false);
  assert.equal(duplicateResponse.body.success, true);
  assert.equal(duplicateResponse.body.data.isDuplicate, true);
  assert.equal(duplicateResponse.body.data.order.id, firstResponse.body.data.order.id);
  assert.equal(orders.length, 1);
  assert.equal(reloadedProduct.stock, 9);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED),
    true
  );
});

test("POST /purchase/with-lock returns LOCK_SERVICE_UNAVAILABLE when lock service cannot be reached", async () => {
  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");
  const originalWithLock = lockService.withLock;

  lockService.withLock = async () => {
    throw new AppError({
      message: "Redis unavailable in test",
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      errorCode: ERROR_CODES.LOCK_SERVICE_UNAVAILABLE
    });
  };

  try {
    const response = await client
      .post("/purchase/with-lock")
      .send(
        createPurchasePayload({
          productId: product.id,
          quantity: 1,
          requestId: "purchase-with-lock-service-unavailable-001",
          userId: "with-lock-user-006"
        })
      )
      .expect(503);

    const order = await orderRepository.findOrderByRequestId("purchase-with-lock-service-unavailable-001");
    const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId(
      "purchase-with-lock-service-unavailable-001"
    );

    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, ERROR_CODES.LOCK_SERVICE_UNAVAILABLE);
    assert.equal(order, null);
    assert.equal(
      attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED),
      true
    );
  } finally {
    lockService.withLock = originalWithLock;
  }
});
