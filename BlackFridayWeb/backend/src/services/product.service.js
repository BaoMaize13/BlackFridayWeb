const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { withTransaction } = require("../database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const AppError = require("../utils/app-error");

const orderRepository = new OrderRepository();
const productRepository = new ProductRepository();
const purchaseAttemptRepository = new PurchaseAttemptRepository();

function createProductNotFoundError(productId) {
  return new AppError({
    message: `Product with id ${productId} was not found`,
    statusCode: HTTP_STATUS.NOT_FOUND,
    errorCode: ERROR_CODES.PRODUCT_NOT_FOUND
  });
}

class ProductService {
  async listProducts() {
    return productRepository.listProducts();
  }

  async getProductById(productId) {
    const product = await productRepository.findProductById(productId);

    if (!product) {
      throw createProductNotFoundError(productId);
    }

    return product;
  }

  async resetProductStock(productId, resetOptions, options = {}) {
    return withTransaction(async (transaction) => {
      const existingProduct = await productRepository.findProductById(productId, {
        executor: transaction
      });

      if (!existingProduct) {
        throw createProductNotFoundError(productId);
      }

      const product = await productRepository.resetProductStock(productId, resetOptions.stock, {
        executor: transaction,
        version: 0
      });

      const deletedOrders = resetOptions.clearOrders
        ? await orderRepository.deleteOrdersByProduct(productId, { executor: transaction })
        : 0;
      const deletedAttemptLogs = resetOptions.clearLogs
        ? await purchaseAttemptRepository.deleteAttemptLogsByProduct(productId, { executor: transaction })
        : 0;

      options.logger?.info(
        {
          action: "product.reset_stock",
          clearLogs: resetOptions.clearLogs,
          clearOrders: resetOptions.clearOrders,
          deletedAttemptLogs,
          deletedOrders,
          productId,
          stock: resetOptions.stock
        },
        "Product stock reset for demo"
      );

      return {
        deletedAttemptLogs,
        deletedOrders,
        product
      };
    });
  }

  async resetAllProducts(resetOptions, options = {}) {
    return withTransaction(async (transaction) => {
      const products = await productRepository.listProducts({}, { executor: transaction });

      if (resetOptions.clearLogs) {
        await purchaseAttemptRepository.deleteAllAttemptLogsForTest({ executor: transaction });
      }

      if (resetOptions.clearOrders) {
        await orderRepository.deleteAllOrdersForTest({ executor: transaction });
      }

      const updatedProducts = [];

      for (const product of products) {
        updatedProducts.push(
          await productRepository.resetProductStock(product.id, resetOptions.stock, {
            executor: transaction,
            version: 0
          })
        );
      }

      options.logger?.info(
        {
          action: "product.reset_all",
          count: updatedProducts.length,
          stock: resetOptions.stock
        },
        "All product stock reset for demo"
      );

      return {
        products: updatedProducts,
        resetCount: updatedProducts.length,
        stock: resetOptions.stock
      };
    });
  }
}

module.exports = new ProductService();
