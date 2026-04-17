const seedProducts = require("../database/seeds/product-seed-data");
const { closeDatabase, initializeDatabase, runMigrations, withTransaction } = require("../database/client");
const OrderRepository = require("../repositories/order.repository");
const ProductRepository = require("../repositories/product.repository");
const PurchaseLogRepository = require("../repositories/purchase-log.repository");
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
      const purchaseLogRepository = new PurchaseLogRepository();

      await purchaseLogRepository.deleteAll({ executor: transaction });
      await orderRepository.deleteAll({ executor: transaction });

      const restoredProducts = [];

      for (const seedProduct of seedProducts) {
        const existingProduct = await productRepository.findByCode(seedProduct.code, {
          executor: transaction
        });

        if (!existingProduct) {
          restoredProducts.push(
            await productRepository.upsertByCode(seedProduct, {
              executor: transaction
            })
          );
          continue;
        }

        restoredProducts.push(
          await productRepository.resetStock(
            {
              productId: existingProduct.id,
              stock: seedProduct.stock,
              price: seedProduct.price,
              name: seedProduct.name
            },
            {
              executor: transaction
            }
          )
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
