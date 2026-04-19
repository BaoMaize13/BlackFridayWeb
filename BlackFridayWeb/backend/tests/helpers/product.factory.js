const { ProductRepository } = require("../../src/repositories");

let productCounter = 0;

function buildTestProductData(overrides = {}) {
  productCounter += 1;

  return {
    code: overrides.code || `TEST-PRODUCT-${Date.now()}-${productCounter}`,
    name: overrides.name || `Test Product ${productCounter}`,
    price: overrides.price ?? 1000,
    stock: overrides.stock ?? 1
  };
}

async function createTestProduct(overrides = {}) {
  const productRepository = new ProductRepository();
  return productRepository.createProduct(buildTestProductData(overrides));
}

async function resetProductForTest(productId, stock) {
  const productRepository = new ProductRepository();
  return productRepository.resetProductStock(productId, stock, {
    version: 0
  });
}

async function getProductStock(productId) {
  const productRepository = new ProductRepository();
  const product = await productRepository.findProductById(productId);
  return product?.stock ?? null;
}

module.exports = {
  buildTestProductData,
  createTestProduct,
  getProductStock,
  resetProductForTest
};
