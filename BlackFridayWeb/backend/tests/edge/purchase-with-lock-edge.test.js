const assert = require("node:assert/strict");
const { after, afterEach, beforeEach, test } = require("node:test");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../../src/constants/domain");
const { ERROR_CODES } = require("../../src/constants/system");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const lockService = require("../../src/services/lock.service");
const purchaseService = require("../../src/services/purchase.service");
const { buildProductLockKey } = require("../../src/utils/lock-key.util");
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

test("with-lock validation edge cases return VALIDATION_ERROR and do not acquire a lock", async () => {
  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");
  const originalWithLock = lockService.withLock;
  let withLockCalled = false;

  lockService.withLock = async (...args) => {
    withLockCalled = true;
    return originalWithLock(...args);
  };

  try {
    const invalidCases = [
      {
        body: {
          quantity: 1,
          requestId: "with-lock-validation-001",
          userId: "edge-user-001"
        },
        expectedField: "productId"
      },
      {
        body: {
          productId: "",
          quantity: 1,
          requestId: "with-lock-validation-002",
          userId: "edge-user-001"
        },
        expectedField: "productId"
      },
      {
        body: {
          productId: product.id,
          requestId: "with-lock-validation-007",
          userId: "edge-user-001"
        },
        expectedField: "quantity"
      },
      {
        body: {
          productId: product.id,
          quantity: 0,
          requestId: "with-lock-validation-008",
          userId: "edge-user-001"
        },
        expectedField: "quantity"
      },
      {
        body: {
          productId: product.id,
          quantity: -1,
          requestId: "with-lock-validation-009",
          userId: "edge-user-001"
        },
        expectedField: "quantity"
      },
      {
        body: {
          productId: product.id,
          quantity: 1.5,
          requestId: "with-lock-validation-010",
          userId: "edge-user-001"
        },
        expectedField: "quantity"
      },
      {
        body: {
          productId: product.id,
          quantity: "abc",
          requestId: "with-lock-validation-011",
          userId: "edge-user-001"
        },
        expectedField: "quantity"
      }
    ];

    for (const invalidCase of invalidCases) {
      const response = await client.post("/api/purchase/with-lock").send(invalidCase.body).expect(400);

      assert.equal(response.body.success, false);
      assert.equal(response.body.error.code, ERROR_CODES.VALIDATION_ERROR);
      assert.equal(
        response.body.error.details.some((detail) => detail.field === invalidCase.expectedField),
        true
      );
    }

    assert.equal(withLockCalled, false);
  } finally {
    lockService.withLock = originalWithLock;
  }
});

test("with-lock purchase returns OUT_OF_STOCK when quantity is greater than current stock", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  const response = await client
    .post("/api/purchase/with-lock")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 2,
        requestId: "with-lock-out-of-stock-quantity-too-large",
        userId: "edge-user-002"
      })
    )
    .expect(409);

  const finalProduct = await productRepository.findProductById(product.id);
  const orderCounts = {
    success: await orderRepository.countSuccessOrdersByProduct(product.id),
    total: await orderRepository.countOrders({
      productId: product.id
    })
  };

  assert.equal(response.body.error.code, ERROR_CODES.OUT_OF_STOCK);
  assert.equal(finalProduct.stock, 1);
  assert.equal(orderCounts.success, 0);
  assert.equal(orderCounts.total, 1);
});

test("with-lock purchase supports quantity > 1 when stock is sufficient", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  const response = await client
    .post("/api/purchase/with-lock")
    .send(
      createPurchasePayload({
        productId: product.id,
        quantity: 2,
        requestId: "with-lock-quantity-two-success",
        userId: "edge-user-003"
      })
    )
    .expect(200);

  const finalProduct = await productRepository.findProductById(product.id);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.order.quantity, 2);
  assert.equal(response.body.data.stock.before, 10);
  assert.equal(response.body.data.stock.after, 8);
  assert.equal(finalProduct.stock, 8);
});

test("with-lock purchase returns PRODUCT_NOT_FOUND and releases the product lock", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const requestId = "with-lock-product-not-found-release";
  const missingProductId = 999999;
  const lockKey = buildProductLockKey(missingProductId);

  const response = await client
    .post("/api/purchase/with-lock")
    .send(
      createPurchasePayload({
        productId: missingProductId,
        quantity: 1,
        requestId,
        userId: "edge-user-004"
      })
    )
    .expect(404);

  const reacquiredLock = await lockService.acquireLock(lockKey, {
    requestId: `${requestId}-reacquire`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  assert.equal(response.body.error.code, ERROR_CODES.PRODUCT_NOT_FOUND);
  assert.equal(reacquiredLock.acquired, true);

  await lockService.releaseLock(lockKey, reacquiredLock.token, {
    requestId: `${requestId}-cleanup`,
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });
});

test("with-lock purchase returns LOCK_TIMEOUT when the product lock is already held", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");
  const lockKey = buildProductLockKey(product.id);
  const originalWithLock = lockService.withLock;
  const primaryLock = await lockService.acquireLock(lockKey, {
    requestId: "with-lock-timeout-primary-lock",
    retryIntervalMs: 25,
    ttlMs: 1000,
    waitTimeoutMs: 250
  });

  lockService.withLock = function patchedWithLock(currentLockKey, handler, options = {}) {
    return originalWithLock.call(this, currentLockKey, handler, {
      ...options,
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 125
    });
  };

  try {
    const requestId = "with-lock-timeout-secondary-request";
    const response = await client
      .post("/api/purchase/with-lock")
      .send(
        createPurchasePayload({
          productId: product.id,
          quantity: 1,
          requestId,
          userId: "edge-user-005"
        })
      )
      .expect(409);

    const order = await orderRepository.findOrderByRequestId(requestId);
    const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId(requestId);
    const finalProduct = await productRepository.findProductById(product.id);

    assert.equal(response.body.error.code, ERROR_CODES.LOCK_TIMEOUT);
    assert.equal(order, null);
    assert.equal(finalProduct.stock, 1);
    assert.equal(
      attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE),
      true
    );
  } finally {
    lockService.withLock = originalWithLock;
    await lockService.releaseLock(lockKey, primaryLock.token, {
      requestId: "with-lock-timeout-primary-cleanup",
      retryIntervalMs: 25,
      ttlMs: 1000,
      waitTimeoutMs: 250
    });
  }
});

test("concurrent duplicate requestId under with-lock creates at most one success order", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");
  const payload = createPurchasePayload({
    productId: product.id,
    quantity: 1,
    requestId: "with-lock-concurrent-duplicate-001",
    userId: "edge-user-006"
  });

  const responses = await Promise.all([
    client.post("/api/purchase/with-lock").set("x-request-id", payload.requestId).send(payload),
    client.post("/api/purchase/with-lock").set("x-request-id", payload.requestId).send(payload)
  ]);

  const orders = await orderRepository.listOrders({
    requestId: payload.requestId
  });
  const finalProduct = await productRepository.findProductById(product.id);
  const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId(payload.requestId);
  const duplicateResponses = responses.filter((response) => response.body?.data?.isDuplicate === true);
  const nonDuplicateResponses = responses.filter((response) => response.body?.data?.isDuplicate === false);

  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, ORDER_STATUSES.SUCCESS);
  assert.equal(finalProduct.stock, 0);
  assert.equal(duplicateResponses.length, 1);
  assert.equal(nonDuplicateResponses.length, 1);
  assert.equal(
    attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED),
    true
  );
});

test("DB error during success order creation rolls back stock update and does not create success order", async (t) => {
  if (!(await ensureRedisAvailable(t))) {
    return;
  }

  const client = getRequestClient();
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");
  const originalCreateOrderRecord = purchaseService.createOrderRecord;

  purchaseService.createOrderRecord = async function patchedCreateOrderRecord(data, options = {}) {
    if (data.status === ORDER_STATUSES.SUCCESS) {
      throw new Error("Simulated database write failure during success order creation");
    }

    return originalCreateOrderRecord.call(this, data, options);
  };

  try {
    const requestId = "with-lock-db-error-001";
    const response = await client
      .post("/api/purchase/with-lock")
      .send(
        createPurchasePayload({
          productId: product.id,
          quantity: 1,
          requestId,
          userId: "edge-user-007"
        })
      )
      .expect(500);

    const finalProduct = await productRepository.findProductById(product.id);
    const order = await orderRepository.findOrderByRequestId(requestId);
    const attemptLogs = await purchaseAttemptRepository.listAttemptLogsByRequestId(requestId);

    assert.equal(response.body.error.code, ERROR_CODES.INTERNAL_ERROR);
    assert.equal(finalProduct.stock, 1);
    assert.equal(order, null);
    assert.equal(
      attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED),
      true
    );
    assert.equal(
      attemptLogs.some((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.STOCK_UPDATED_WITH_LOCK),
      false
    );
  } finally {
    purchaseService.createOrderRecord = originalCreateOrderRecord;
  }
});
