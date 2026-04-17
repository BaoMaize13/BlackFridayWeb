const { closeDatabase, initializeDatabase, runMigrations } = require("../database/client");
const ProductRepository = require("../repositories/product.repository");
const { logger } = require("../utils/logger");

async function listProducts() {
  await initializeDatabase();
  await runMigrations();

  try {
    const productRepository = new ProductRepository();
    const products = await productRepository.list();

    logger.info(
      {
        totalProducts: products.length,
        products
      },
      "Current product data snapshot"
    );

    return products;
  } finally {
    await closeDatabase();
  }
}

if (require.main === module) {
  listProducts().catch((error) => {
    logger.error({ err: error }, "Failed to list products");
    process.exit(1);
  });
}

module.exports = {
  listProducts
};
