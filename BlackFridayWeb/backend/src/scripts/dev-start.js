const seedProducts = require("../database/seeds/product-seed-data");
const seedUsers = require("../database/seeds/user-seed-data");
const { initializeDatabase, runMigrations, withTransaction } = require("../database/client");
const { ProductRepository } = require("../repositories");
const authService = require("../services/auth.service");
const { startServer } = require("../server");
const { logger } = require("../utils/logger");

async function seedDevelopmentData() {
  return withTransaction(async (transaction) => {
    const productRepository = new ProductRepository();
    const users = await authService.seedUsers(seedUsers, {
      executor: transaction
    });
    const products = [];
    let createdProducts = 0;

    for (const seedProduct of seedProducts) {
      const existingProduct = await productRepository.findProductByCode(seedProduct.code, {
        executor: transaction
      });

      if (existingProduct) {
        products.push(existingProduct);
        continue;
      }

      const createdProduct = await productRepository.createProduct(seedProduct, {
        executor: transaction
      });

      products.push(createdProduct);
      createdProducts += 1;
    }

    return {
      createdProducts,
      totalProducts: products.length,
      totalUsers: users.length
    };
  });
}

async function prepareDevelopmentRuntime() {
  await initializeDatabase();
  await runMigrations();

  const seedResult = await seedDevelopmentData();

  logger.info(
    {
      createdProducts: seedResult.createdProducts,
      totalProducts: seedResult.totalProducts,
      totalUsers: seedResult.totalUsers
    },
    "Development bootstrap completed"
  );

  return seedResult;
}

async function startDevelopmentRuntime() {
  await prepareDevelopmentRuntime();
  return startServer();
}

if (require.main === module) {
  startDevelopmentRuntime().catch((error) => {
    logger.fatal({ err: error }, "Development bootstrap failed");
    process.exit(1);
  });
}

module.exports = {
  prepareDevelopmentRuntime,
  startDevelopmentRuntime
};
