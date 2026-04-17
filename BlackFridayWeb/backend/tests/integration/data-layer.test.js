const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../src/constants/domain");
const { closeDatabase, getDatabaseState, initializeDatabase, runMigrations } = require("../../src/database/client");
const OrderRepository = require("../../src/repositories/order.repository");
const ProductRepository = require("../../src/repositories/product.repository");
const PurchaseLogRepository = require("../../src/repositories/purchase-log.repository");
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
  const products = await productRepository.list();
  const lowStockProduct = await productRepository.findByCode("BF-LOW-STOCK-001");

  assert.equal(seededProducts.length >= 3, true);
  assert.equal(products.length >= 3, true);
  assert.equal(lowStockProduct.stock, 1);
  assert.equal(lowStockProduct.version, 0);
}

async function testProductRepositorySupportsOptimisticReadyUpdates() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const product = await productRepository.findByCode("BF-LOW-STOCK-001");
  const updatedProduct = await productRepository.updateStock({
    productId: product.id,
    stock: 0,
    expectedVersion: product.version
  });
  const staleVersionUpdate = await productRepository.updateStock({
    productId: product.id,
    stock: 5,
    expectedVersion: product.version
  });

  assert.equal(updatedProduct.stock, 0);
  assert.equal(updatedProduct.version, 1);
  assert.equal(staleVersionUpdate, null);
}

async function testOrderAndPurchaseLogRepositories() {
  await resetTestData();

  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const purchaseLogRepository = new PurchaseLogRepository();
  const product = await productRepository.findByCode("BF-MEDIUM-STOCK-010");

  const order = await orderRepository.create({
    buyerRef: "buyer-demo-001",
    failureReason: null,
    productId: product.id,
    quantity: 1,
    requestId: "order-request-001",
    status: ORDER_STATUSES.SUCCESS
  });

  const purchaseLog = await purchaseLogRepository.create({
    action: PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
    message: "Stock updated during data-layer integration test",
    productId: product.id,
    requestId: order.requestId,
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 10
  });

  const orderByRequestId = await orderRepository.findByRequestId(order.requestId);
  const purchaseLogs = await purchaseLogRepository.listByRequestId(order.requestId);
  const successCount = await orderRepository.countSuccessByProduct(product.id);

  assert.equal(orderByRequestId.requestId, "order-request-001");
  assert.equal(purchaseLog.requestId, "order-request-001");
  assert.equal(purchaseLogs.length, 1);
  assert.equal(successCount, 1);
}

async function runDataLayerIntegrationTests() {
  const testCases = [
    ["Database initializes and migrations run", testDatabaseInitialization],
    ["Baseline seed creates low-stock product data", testSeedBaselineData],
    ["Product repository supports optimistic-ready stock updates", testProductRepositorySupportsOptimisticReadyUpdates],
    ["Order and purchase log repositories persist audit-friendly records", testOrderAndPurchaseLogRepositories]
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
