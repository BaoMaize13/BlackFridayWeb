const seedProducts = require("../database/seeds/product-seed-data");
const seedUsers = require("../database/seeds/user-seed-data");
const { closeDatabase, initializeDatabase, runMigrations, withTransaction } = require("../database/client");
const { ProductRepository } = require("../repositories");
const authService = require("../services/auth.service");
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
      const users = await authService.seedUsers(seedUsers, {
        executor: transaction
      });
      const records = [];

      for (const seedProduct of seedProducts) {
        const product = await productRepository.upsertProductByCode(seedProduct, {
          executor: transaction
        });

        records.push(product);
      }

      logger.info(
        {
          totalProducts: records.length,
          productCodes: records.map((product) => product.code),
          totalUsers: users.length
        },
        "Baseline product seed completed"
      );

      return {
        products: records,
        users
      };
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
