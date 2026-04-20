const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../src/constants/domain");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");
const { getRequestClient, loginAsAdmin } = require("../helpers/request.helper");

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("POST /admin/products creates a product and GET endpoints return it", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const createResponse = await client
    .post("/api/admin/products")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .set("x-request-id", "admin-create-product-001")
    .send({
      code: "TEST-PRODUCT-ADMIN-001",
      name: "Admin Product",
      price: 150000,
      stock: 1
    })
    .expect(201);

  const productId = createResponse.body.data.id;
  const listResponse = await client
    .get("/api/admin/products")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .query({ code: "TEST-PRODUCT-ADMIN-001" })
    .expect(200);
  const detailResponse = await client
    .get(`/api/admin/products/${productId}`)
    .set("Authorization", `Bearer ${adminSession.token}`)
    .expect(200);

  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.code, "TEST-PRODUCT-ADMIN-001");
  assert.equal(createResponse.body.meta.requestId, "admin-create-product-001");
  assert.equal(listResponse.body.data.length, 1);
  assert.equal(detailResponse.body.data.id, productId);
});

test("GET /api/admin/products requires authentication", async () => {
  const client = getRequestClient();
  const response = await client.get("/api/admin/products").expect(401);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "UNAUTHORIZED");
});

test("GET /api/admin/products/:productId returns 404 for missing product", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const response = await client
    .get("/api/admin/products/999999")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .expect(404);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "PRODUCT_NOT_FOUND");
});

test("POST /admin/products validates required fields and rejects duplicate code", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);

  const invalidResponse = await client
    .post("/api/admin/products")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .send({
      code: "",
      name: "",
      price: -1,
      stock: -1
    })
    .expect(422);

  const duplicateResponse = await client
    .post("/api/admin/products")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .send({
      code: "BF-LOW-STOCK-001",
      name: "Duplicate Product",
      price: 10000,
      stock: 1
    })
    .expect(409);

  assert.equal(invalidResponse.body.error.code, "VALIDATION_ERROR");
  assert.equal(Array.isArray(invalidResponse.body.error.details), true);
  assert.equal(duplicateResponse.body.error.code, "DUPLICATE_PRODUCT_CODE");
});

test("PATCH /admin/products/:productId/stock updates stock and rejects invalid stock", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const productRepository = new ProductRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  const updateResponse = await client
    .patch(`/api/admin/products/${product.id}/stock`)
    .set("Authorization", `Bearer ${adminSession.token}`)
    .send({ stock: 5 })
    .expect(200);

  const invalidResponse = await client
    .patch(`/api/admin/products/${product.id}/stock`)
    .set("Authorization", `Bearer ${adminSession.token}`)
    .send({ stock: -1 })
    .expect(422);

  assert.equal(updateResponse.body.data.stock, 5);
  assert.equal(invalidResponse.body.error.code, "VALIDATION_ERROR");
});

test("POST /admin/products/:productId/reset resets stock and clears orders/logs when requested", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  await orderRepository.createOrder({
    buyerRef: "buyer-reset-001",
    productId: product.id,
    quantity: 1,
    requestId: "admin-reset-order-001",
    status: ORDER_STATUSES.SUCCESS
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Attempt log before reset",
    productId: product.id,
    requestId: "admin-reset-order-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 10
  });

  const response = await client
    .post(`/api/admin/products/${product.id}/reset`)
    .set("Authorization", `Bearer ${adminSession.token}`)
    .send({
      clearLogs: true,
      clearOrders: true,
      stock: 1
    })
    .expect(200);

  assert.equal(response.body.data.product.stock, 1);
  assert.equal(response.body.data.deletedOrders, 1);
  assert.equal(response.body.data.deletedAttemptLogs, 1);
});

test("GET /admin/orders supports filtering by productId and status", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  await orderRepository.createOrder({
    buyerRef: "buyer-order-001",
    productId: product.id,
    quantity: 1,
    requestId: "admin-order-001",
    status: ORDER_STATUSES.SUCCESS
  });
  await orderRepository.createOrder({
    buyerRef: "buyer-order-002",
    failureReason: "OUT_OF_STOCK",
    productId: product.id,
    quantity: 1,
    requestId: "admin-order-002",
    status: ORDER_STATUSES.FAILED
  });

  const response = await client
    .get("/api/admin/orders")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .query({
      productId: product.id,
      status: ORDER_STATUSES.SUCCESS
    })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].status, ORDER_STATUSES.SUCCESS);
});

test("DELETE /admin/orders requires confirmation when deleting all orders", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const response = await client
    .delete("/api/admin/orders")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "CONFIRMATION_REQUIRED");
});

test("GET /admin/attempt-logs supports filtering by productId and requestId", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const productRepository = new ProductRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.REQUEST_RECEIVED,
    message: "First log",
    productId: product.id,
    requestId: "admin-attempt-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Second log",
    productId: product.id,
    requestId: "admin-attempt-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 0,
    stockBefore: 1
  });

  const listResponse = await client
    .get("/api/admin/attempt-logs")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .query({
      productId: product.id,
      requestId: "admin-attempt-001"
    })
    .expect(200);
  const traceResponse = await client
    .get("/api/admin/attempt-logs/admin-attempt-001")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .expect(200);

  assert.equal(listResponse.body.data.length, 2);
  assert.equal(traceResponse.body.data.length, 2);
  assert.equal(traceResponse.body.data[0].requestId, "admin-attempt-001");
});

test("GET /admin/stats returns stock and order counts for a product", async () => {
  const client = getRequestClient();
  const adminSession = await loginAsAdmin(client);
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await orderRepository.createOrder({
    buyerRef: "buyer-stats-001",
    productId: product.id,
    quantity: 1,
    requestId: "admin-stats-order-001",
    status: ORDER_STATUSES.SUCCESS
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Order created for stats endpoint",
    productId: product.id,
    requestId: "admin-stats-order-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 0,
    stockBefore: 1
  });

  const response = await client
    .get("/api/admin/stats")
    .set("Authorization", `Bearer ${adminSession.token}`)
    .query({ productId: product.id })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.totalProducts >= 3, true);
  assert.equal(response.body.data.totalOrders, 1);
  assert.equal(response.body.data.successOrders, 1);
  assert.equal(response.body.data.failedOrders, 0);
  assert.equal(response.body.data.totalAttemptLogs, 1);
  assert.equal(response.body.data.productStock, 1);
});
