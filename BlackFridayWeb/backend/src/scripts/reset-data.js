const seedProducts = require("../database/seeds/product-seed-data");
const seedUsers = require("../database/seeds/user-seed-data");
const { closeDatabase, initializeDatabase, runMigrations, withTransaction } = require("../database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const authService = require("../services/auth.service");
const { logger } = require("../utils/logger");

async function resetTestData(options = {}) {
  const manageLifecycle = options.manageLifecycle ?? false;

  if (manageLifecycle) {
    await initializeDatabase();
    await runMigrations();
  }

  try {
    const restoredProducts = await withTransaction(async (transaction) => {
      const orderRepository = new OrderRepository();
      const productRepository = new ProductRepository();
      const purchaseAttemptRepository = new PurchaseAttemptRepository();

      await purchaseAttemptRepository.deleteAllAttemptLogsForTest({ executor: transaction });
      await orderRepository.deleteAllOrdersForTest({ executor: transaction });
      await authService.seedUsers(seedUsers, {
        executor: transaction
      });

      const restoredProducts = [];

      for (const seedProduct of seedProducts) {
        restoredProducts.push(
          await productRepository.upsertProductByCode(seedProduct, {
            executor: transaction
          })
        );
      }

      logger.info(
        {
          restoredProducts: restoredProducts.map((product) => ({
            code: product.code,
            stock: product.stock,
            version: product.version
          }))
        },
        "Test data reset completed"
      );

      return restoredProducts;
    });

    return restoredProducts;
  } finally {
    if (manageLifecycle) {
      await closeDatabase();
    }
  }
}

if (require.main === module) {
  resetTestData({ manageLifecycle: true }).catch((error) => {
    logger.error({ err: error }, "Test data reset failed");
    process.exit(1);
  });
}

module.exports = {
  resetTestData
};
