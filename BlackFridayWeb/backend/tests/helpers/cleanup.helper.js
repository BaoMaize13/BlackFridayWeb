const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../../src/repositories");
const { ORDER_STATUSES } = require("../../src/constants/domain");
const { getDatabaseClient } = require("../../src/database/client");
const { resetTestData } = require("../../src/scripts/reset-data");
const { cleanupTestRedisKeys } = require("../setup/test-redis");

async function clearOrdersAndLogs(productId) {
  const orderRepository = new OrderRepository();
  const purchaseAttemptRepository = new PurchaseAttemptRepository();

  await purchaseAttemptRepository.deleteAttemptLogsByProduct(productId);
  await orderRepository.deleteOrdersByProduct(productId);
}

async function countOrdersByStatus(productId) {
  const orderRepository = new OrderRepository();

  return {
    failed: await orderRepository.countOrders({
      productId,
      status: ORDER_STATUSES.FAILED
    }),
    success: await orderRepository.countOrders({
      productId,
      status: ORDER_STATUSES.SUCCESS
    }),
    total: await orderRepository.countOrders({
      productId
    })
  };
}

async function cleanupTestProducts() {
  const productRepository = new ProductRepository();
  const client = getDatabaseClient();
  const products = await productRepository.listProducts();
  const testProducts = products.filter((product) => product.code.startsWith("TEST-PRODUCT-"));

  if (testProducts.length === 0) {
    return;
  }

  const productIds = testProducts.map((product) => product.id);

  await client("purchase_logs").whereIn("product_id", productIds).del();
  await client("orders").whereIn("product_id", productIds).del();
  await client("products").whereIn("id", productIds).del();
}

async function cleanupTestData() {
  await cleanupTestProducts();
  await resetTestData();
  await cleanupTestRedisKeys();
}

module.exports = {
  cleanupTestData,
  clearOrdersAndLogs,
  countOrdersByStatus
};
