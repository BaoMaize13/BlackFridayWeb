const ProductRepository = require("../repositories/product.repository");
const seedProducts = require("../database/seeds/product-seed-data");
const { closeDatabase, initializeDatabase, runMigrations, withTransaction } = require("../database/client");
const { logger } = require("../utils/logger");

async function seedBaselineData(options = {}) {
  const manageLifecycle = options.manageLifecycle ?? false;

  if (manageLifecycle) {
    await initializeDatabase();
    await runMigrations();
  }

  try {
    const seededRecords = await withTransaction(async (transaction) => {
      const productRepository = new ProductRepository();
      const records = [];

      for (const seedProduct of seedProducts) {
        const product = await productRepository.upsertByCode(seedProduct, {
          executor: transaction
        });

        records.push(product);
      }

      logger.info(
        {
          totalProducts: records.length,
          productCodes: records.map((product) => product.code)
        },
        "Baseline product seed completed"
      );

      return records;
    });

    return seededRecords;
  } finally {
    if (manageLifecycle) {
      await closeDatabase();
    }
  }
}

if (require.main === module) {
  seedBaselineData({ manageLifecycle: true }).catch((error) => {
    logger.error({ err: error }, "Baseline product seed failed");
    process.exit(1);
  });
}

module.exports = {
  seedBaselineData
};
