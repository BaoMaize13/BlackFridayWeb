const assert = require("node:assert/strict");

const request = require("supertest");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../src/constants/domain");
const { createApp } = require("../../src/app");
const { closeDatabase, initializeDatabase, runMigrations } = require("../../src/database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { resetTestData } = require("../../src/scripts/reset-data");

const app = createApp();

async function ensureDatabaseReady() {
  await initializeDatabase();
  await runMigrations();
}

async function testProductAdminApis() {
  await resetTestData();

  const createResponse = await request(app)
    .post("/admin/products")
    .set("x-request-id", "admin-create-product")
    .send({
      code: "ADMIN-PRODUCT-001",
      name: "Admin Product",
      price: 150000,
      stock: 1
    })
    .expect(201);

  const productId = createResponse.body.data.id;

  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.code, "ADMIN-PRODUCT-001");
  assert.equal(createResponse.body.meta.requestId, "admin-create-product");

  const listResponse = await request(app)
    .get("/admin/products")
    .query({ code: "ADMIN-PRODUCT-001" })
    .expect(200);

  assert.equal(listResponse.body.data.length, 1);

  const detailResponse = await request(app).get(`/admin/products/${productId}`).expect(200);

  assert.equal(detailResponse.body.data.id, productId);

  const updateResponse = await request(app)
    .patch(`/admin/products/${productId}/stock`)
    .send({ stock: 5 })
    .expect(200);

  assert.equal(updateResponse.body.data.stock, 5);

  const resetResponse = await request(app)
    .post(`/admin/products/${productId}/reset`)
    .send({
      clearLogs: false,
      clearOrders: false,
      stock: 1
    })
    .expect(200);

  assert.equal(resetResponse.body.data.product.stock, 1);
  assert.equal(resetResponse.body.data.deletedOrders, 0);
  assert.equal(resetResponse.body.data.deletedAttemptLogs, 0);
}

async function testValidationAndDuplicateProductCodeHandling() {
  await resetTestData();

  const duplicateResponse = await request(app)
    .post("/admin/products")
    .send({
      code: "BF-LOW-STOCK-001",
      name: "Duplicate Product",
      price: 10000,
      stock: 1
    })
    .expect(409);

  assert.equal(duplicateResponse.body.error.code, "DUPLICATE_PRODUCT_CODE");

  const invalidStockResponse = await request(app)
    .patch("/admin/products/1/stock")
    .send({
      stock: -1
    })
    .expect(422);

  assert.equal(invalidStockResponse.body.error.code, "VALIDATION_ERROR");
}

async function testOrderAdminApis() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  const order = await orderRepository.createOrder({
    buyerRef: "admin-order-buyer-001",
    productId: product.id,
    quantity: 1,
    requestId: "admin-order-request-001",
    status: ORDER_STATUSES.SUCCESS
  });

  await orderRepository.createOrder({
    buyerRef: "admin-order-buyer-002",
    failureReason: "Simulated failure record",
    productId: product.id,
    quantity: 1,
    requestId: "admin-order-request-002",
    status: ORDER_STATUSES.FAILED
  });

  const listResponse = await request(app)
    .get("/admin/orders")
    .query({
      productId: product.id,
      status: ORDER_STATUSES.SUCCESS
    })
    .expect(200);

  assert.equal(listResponse.body.data.length, 1);

  const detailResponse = await request(app).get(`/admin/orders/${order.id}`).expect(200);

  assert.equal(detailResponse.body.data.requestId, "admin-order-request-001");

  const confirmationRequiredResponse = await request(app).delete("/admin/orders").expect(400);

  assert.equal(confirmationRequiredResponse.body.error.code, "CONFIRMATION_REQUIRED");

  const deleteResponse = await request(app)
    .delete("/admin/orders")
    .query({ productId: product.id })
    .expect(200);

  assert.equal(deleteResponse.body.data.deletedCount, 2);
}

async function testAttemptLogAndStatsAdminApis() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  await orderRepository.createOrder({
    buyerRef: "stats-buyer-001",
    productId: product.id,
    quantity: 1,
    requestId: "stats-order-request-001",
    status: ORDER_STATUSES.SUCCESS
  });

  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.REQUEST_RECEIVED,
    message: "Request received for stats test",
    productId: product.id,
    requestId: "stats-attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Order created for stats test",
    productId: product.id,
    requestId: "stats-attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 0,
    stockBefore: 1
  });

  const listLogsResponse = await request(app)
    .get("/admin/attempt-logs")
    .query({
      productId: product.id,
      result: PURCHASE_LOG_RESULTS.SUCCESS
    })
    .expect(200);

  assert.equal(listLogsResponse.body.data.length, 2);

  const requestTraceResponse = await request(app)
    .get("/admin/attempt-logs/stats-attempt-request-001")
    .expect(200);

  assert.equal(requestTraceResponse.body.data.length, 2);
  assert.equal(requestTraceResponse.body.data[0].action, PURCHASE_LOG_ACTIONS.REQUEST_RECEIVED);

  const statsResponse = await request(app)
    .get("/admin/stats")
    .query({ productId: product.id })
    .expect(200);

  assert.equal(statsResponse.body.data.totalProducts >= 3, true);
  assert.equal(statsResponse.body.data.totalOrders, 1);
  assert.equal(statsResponse.body.data.successOrders, 1);
  assert.equal(statsResponse.body.data.failedOrders, 0);
  assert.equal(statsResponse.body.data.totalAttemptLogs, 2);
  assert.equal(statsResponse.body.data.productStock, 1);

  const deleteAllLogsWithoutConfirmResponse = await request(app).delete("/admin/attempt-logs").expect(400);

  assert.equal(deleteAllLogsWithoutConfirmResponse.body.error.code, "CONFIRMATION_REQUIRED");

  const resetResponse = await request(app)
    .post(`/admin/products/${product.id}/reset`)
    .send({
      clearLogs: true,
      clearOrders: true,
      stock: 1
    })
    .expect(200);

  assert.equal(resetResponse.body.data.deletedOrders, 1);
  assert.equal(resetResponse.body.data.deletedAttemptLogs, 2);
  assert.equal(resetResponse.body.data.product.stock, 1);
}

async function runAdminApiIntegrationTests() {
  const testCases = [
    ["Admin product APIs create, list, retrieve, update, and reset products", testProductAdminApis],
    ["Admin product APIs validate payloads and reject duplicate codes", testValidationAndDuplicateProductCodeHandling],
    ["Admin order APIs list, retrieve, and delete orders safely", testOrderAdminApis],
    ["Admin attempt log and stats APIs return demo data and support reset flows", testAttemptLogAndStatsAdminApis]
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
  runAdminApiIntegrationTests
};
