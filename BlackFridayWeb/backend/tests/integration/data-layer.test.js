const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../src/constants/domain");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("baseline test database is initialized with seeded products", async () => {
  const productRepository = new ProductRepository();
  const products = await productRepository.listProducts();
  const lowStockProduct = await productRepository.findProductByCode("BF-LOW-STOCK-001");

  assert.equal(products.length >= 3, true);
  assert.equal(lowStockProduct.stock, 1);
  assert.equal(lowStockProduct.version, 0);
});

test("ProductRepository supports create, find, reset, versioned update, and stock constraint behavior", async () => {
  const productRepository = new ProductRepository();
  const createdProduct = await productRepository.createProduct({
    code: "TEST-PRODUCT-REPO-001",
    name: "Repository Product",
    price: 99000,
    stock: 3
  });
  const foundById = await productRepository.findProductById(createdProduct.id);
  const foundByCode = await productRepository.findProductByCode(createdProduct.code);
  const incrementedProduct = await productRepository.incrementProductStock(createdProduct.id, -1);
  const resetProduct = await productRepository.resetProductStock(createdProduct.id, 10, {
    version: 0
  });
  const versionedUpdate = await productRepository.updateProductStock(createdProduct.id, 7, {
    expectedVersion: resetProduct.version
  });
  const staleVersionUpdate = await productRepository.updateProductStock(createdProduct.id, 2, {
    expectedVersion: resetProduct.version
  });

  assert.equal(foundById.code, createdProduct.code);
  assert.equal(foundByCode.id, createdProduct.id);
  assert.equal(incrementedProduct.stock, 2);
  assert.equal(resetProduct.stock, 10);
  assert.equal(versionedUpdate.stock, 7);
  assert.equal(versionedUpdate.version, 1);
  assert.equal(staleVersionUpdate, null);

  await assert.rejects(() => productRepository.updateProductStock(createdProduct.id, -1), (error) => {
    assert.equal(error.code, "SQLITE_CONSTRAINT");
    return true;
  });
});

test("OrderRepository supports success and failed orders, filters, and aggregate counts", async () => {
  const productRepository = new ProductRepository();
  const orderRepository = new OrderRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  const successOrder = await orderRepository.createOrder({
    buyerRef: "buyer-success-001",
    productId: product.id,
    quantity: 1,
    requestId: "order-request-001",
    status: ORDER_STATUSES.SUCCESS
  });

  await orderRepository.createOrder({
    buyerRef: "buyer-failed-001",
    failureReason: "OUT_OF_STOCK",
    productId: product.id,
    quantity: 1,
    requestId: "order-request-002",
    status: ORDER_STATUSES.FAILED
  });

  const foundByRequestId = await orderRepository.findOrderByRequestId("order-request-001");
  const successOrders = await orderRepository.listOrders({
    productId: product.id,
    status: ORDER_STATUSES.SUCCESS
  });
  const totalOrders = await orderRepository.countOrders({
    productId: product.id
  });
  const successCount = await orderRepository.countSuccessOrdersByProduct(product.id);
  const successQuantity = await orderRepository.sumSuccessfulOrderQuantityByProduct(product.id);

  assert.equal(foundByRequestId.id, successOrder.id);
  assert.equal(successOrders.length, 1);
  assert.equal(totalOrders, 2);
  assert.equal(successCount, 1);
  assert.equal(successQuantity, 1);
});

test("PurchaseAttemptRepository supports create, list by filters, and cleanup", async () => {
  const productRepository = new ProductRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();
  const product = await productRepository.findProductByCode("BF-MEDIUM-STOCK-010");

  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
    message: "Stock updated during repository test",
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 10
  });
  await purchaseAttemptRepository.createAttemptLog({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    message: "Order created during repository test",
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS,
    serverId: process.env.SERVER_ID,
    stockAfter: 9,
    stockBefore: 9
  });

  const logsByRequestId = await purchaseAttemptRepository.listAttemptLogsByRequestId("attempt-request-001");
  const filteredLogs = await purchaseAttemptRepository.listAttemptLogs({
    action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
    productId: product.id,
    requestId: "attempt-request-001",
    result: PURCHASE_LOG_RESULTS.SUCCESS
  });
  const deletedLogs = await purchaseAttemptRepository.deleteAttemptLogsByProduct(product.id);
  const remainingLogs = await purchaseAttemptRepository.listAttemptLogsByProduct(product.id);

  assert.equal(logsByRequestId.length, 2);
  assert.equal(filteredLogs.length, 1);
  assert.equal(filteredLogs[0].action, PURCHASE_LOG_ACTIONS.ORDER_CREATED);
  assert.equal(deletedLogs, 2);
  assert.equal(remainingLogs.length, 0);
});
