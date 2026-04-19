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

function isDuplicateProductCodeError(error) {
  const message = String(error?.message || "");

  return (
    (error?.code === "SQLITE_CONSTRAINT" && message.includes("products.code")) ||
    (error?.code === "23505" && (message.includes("products.code") || message.includes("code")))
  );
}

class AdminProductService {
  async createProduct(data, options = {}) {
    try {
      const product = await productRepository.createProduct(data);

      options.logger?.info(
        {
          action: "admin.create_product",
          productId: product.id
        },
        "Admin product created"
      );

      return product;
    } catch (error) {
      if (isDuplicateProductCodeError(error)) {
        throw new AppError({
          message: `Product code '${data.code}' already exists`,
          statusCode: HTTP_STATUS.CONFLICT,
          errorCode: ERROR_CODES.DUPLICATE_PRODUCT_CODE
        });
      }

      throw error;
    }
  }

  async listProducts(filter = {}) {
    return productRepository.listProducts(filter);
  }

  async getProductById(productId) {
    const product = await productRepository.findProductById(productId);

    if (!product) {
      throw createProductNotFoundError(productId);
    }

    return product;
  }

  async updateProductStock(productId, stock, options = {}) {
    const product = await productRepository.updateProductStock(productId, stock);

    if (!product) {
      throw createProductNotFoundError(productId);
    }

    options.logger?.info(
      {
        action: "admin.update_product_stock",
        productId,
        stock
      },
      "Admin product stock updated"
    );

    return product;
  }

  async resetProductData(productId, resetOptions, options = {}) {
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
        ? await orderRepository.deleteOrdersByProduct(productId, {
            executor: transaction
          })
        : 0;

      const deletedAttemptLogs = resetOptions.clearLogs
        ? await purchaseAttemptRepository.deleteAttemptLogsByProduct(productId, {
            executor: transaction
          })
        : 0;

      options.logger?.info(
        {
          action: "admin.reset_product_demo_data",
          clearLogs: resetOptions.clearLogs,
          clearOrders: resetOptions.clearOrders,
          deletedAttemptLogs,
          deletedOrders,
          productId,
          stock: resetOptions.stock
        },
        "Admin product demo data reset"
      );

      return {
        deletedAttemptLogs,
        deletedOrders,
        product
      };
    });
  }
}

module.exports = new AdminProductService();
