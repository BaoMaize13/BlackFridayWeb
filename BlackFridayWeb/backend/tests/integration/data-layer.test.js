const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../src/constants/domain");
const { closeDatabase, getDatabaseState, initializeDatabase, runMigrations } = require("../../src/database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { resetTestData } = require("../../src/scripts/reset-data");
const { seedBaselineData } = require("../../src/scripts/seed");

function removeSqliteArtifacts() {
  if (process.env.DB_URL === ":memory:") {
    return;
  }

  const databaseFile = path.resolve(process.cwd(), process.env.DB_URL);
  const artifacts = [databaseFile, `${databaseFile}-shm`, `${databaseFile}-wal`, `${databaseFile}-journal`];

  for (const artifact of artifacts) {
    if (fs.existsSync(artifact)) {
      try {
        fs.rmSync(artifact, { force: true });
      } catch (error) {
        if (error.code !== "EPERM") {
          throw error;
        }
      }
    }
  }
}

async function testDatabaseInitialization() {
  removeSqliteArtifacts();

  await initializeDatabase();
  await runMigrations();

  const databaseState = getDatabaseState();

  assert.equal(databaseState.connected, true);
  assert.equal(databaseState.client, "sqlite3");
}

async function testSeedBaselineData() {
  await resetTestData();
  const seededProducts = await seedBaselineData();
  const productRepository = new ProductRepository();
  const products = await productRepository.listProducts();
  const lowStockProduct = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  assert.equal(seededProducts.length >= 3, true);
  assert.equal(products.length >= 3, true);
  assert.equal(lowStockProduct.stock, 1);
  assert.equal(lowStockProduct.version, 0);
}

async function testProductRepositorySupportsRepositoryOperations() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const createdProduct = await productRepository.createProduct({
    code: "BF-TEST-REPO-001",
    name: "Repository Layer Test Product",
    price: 99000,
    stock: 3
  });
  const foundById = await productRepository.findProductById(createdProduct.id);
  const foundByCode = await productRepository.findProductByCode(createdProduct.code);
  const listedProducts = await productRepository.listProducts({
    code: createdProduct.code
  });
  const incrementedProduct = await productRepository.incrementProductStock(createdProduct.id, -1);
  const resetProduct = await productRepository.resetProductStock(createdProduct.id, 10);
  const versionedUpdate = await productRepository.updateProductStock(createdProduct.id, 7, {
    expectedVersion: resetProduct.version
  });
  const staleVersionUpdate = await productRepository.updateProductStock(createdProduct.id, 2, {
    expectedVersion: resetProduct.version
  });

  assert.equal(foundById.code, "BF-TEST-REPO-001");
  assert.equal(foundByCode.id, createdProduct.id);
  assert.equal(listedProducts.length, 1);
  assert.equal(incrementedProduct.stock, 2);
  assert.equal(resetProduct.stock, 10);
  assert.equal(resetProduct.version, 0);
  assert.equal(versionedUpdate.stock, 7);
  assert.equal(versionedUpdate.version, 1);
  assert.equal(staleVersionUpdate, null);
}

async function testOrderRepositorySupportsFiltersAndCounts() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  const order = await orderRepository.createOrder({
    buyerRef: "buyer-demo-001",
    failureReason: null,
    productId: product.id,
    quantity: 1,
    requestId: "order-request-001",
    status: ORDER_STATUSES.SUCCESS
  });
  const failedOrder = await orderRepository.createOrder({
    buyerRef: "buyer-demo-002",
    failureReason: "Validation failed in later phase test path",
    productId: product.id,
    quantity: 1,
    requestId: "order-request-002",
    status: ORDER_STATUSES.FAILED
  });

  const orderById = await orderRepository.findOrderById(order.id);
  const orderByRequestId = await orderRepository.findOrderByRequestId(order.requestId);
  const successOrders = await orderRepository.listOrders({
    productId: product.id,
    status: ORDER_STATUSES.SUCCESS
  });
  const totalOrders = await orderRepository.countOrders({
    productId: product.id
  });
  const successCount = await orderRepository.countSuccessOrdersByProduct(product.id);
  const deletedOrders = await orderRepository.deleteOrdersByProduct(product.id);
  const remainingOrders = await orderRepository.countOrders({
    productId: product.id
  });

  assert.equal(orderById.requestId, "order-request-001");
  assert.equal(orderByRequestId.requestId, "order-request-001");
  assert.equal(successOrders.length, 1);
  assert.equal(totalOrders, 2);
  assert.equal(successCount, 1);
  assert.equal(deletedOrders, 2);
  assert.equal(remainingOrders, 0);
  assert.equal(failedOrder.status, ORDER_STATUSES.FAILED);
}

async function testPurchaseAttemptRepositorySupportsTraceQueries() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  const purchaseLog = await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
    message: "Stock updated during data-layer integration test",
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 10
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Order record created during repository integration test",
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 9
  });

  const logsByRequestId = await purchaseAttemptRepository.listAttemptLogsByRequestId("attempt-request-001");
  const logsByProduct = await purchaseAttemptRepository.listAttemptLogsByProduct(product.id);
  const filteredLogs = await purchaseAttemptRepository.listAttemptLogs({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS
  });
  const deletedLogs = await purchaseAttemptRepository.deleteAttemptLogsByProduct(product.id);
  const remainingLogs = await purchaseAttemptRepository.listAttemptLogsByProduct(product.id);

  assert.equal(purchaseLog.requestId, "attempt-request-001");
  assert.equal(logsByRequestId.length, 2);
  assert.equal(logsByProduct.length, 2);
  assert.equal(filteredLogs.length, 1);
  assert.equal(filteredLogs[0].action, PURCHASE_LOG_ACTIONS.ORDER_CREATED);
  assert.equal(deletedLogs, 2);
  assert.equal(remainingLogs.length, 0);
}

async function runDataLayerIntegrationTests() {
  const testCases = [
    ["Database initializes and migrations run", testDatabaseInitialization],
    ["Baseline seed creates low-stock product data", testSeedBaselineData],
    ["Product repository supports core CRUD-style stock operations", testProductRepositorySupportsRepositoryOperations],
    ["Order repository supports filters, counts, and cleanup helpers", testOrderRepositorySupportsFiltersAndCounts],
    ["Purchase attempt repository supports trace queries and cleanup", testPurchaseAttemptRepositorySupportsTraceQueries]
  ];

  try {
    for (const [name, testCase] of testCases) {
      await testCase();
      console.log(`PASS ${name}`);
    }
  } finally {
    await closeDatabase();
    removeSqliteArtifacts();
  }
}

module.exports = {
  runDataLayerIntegrationTests
};
