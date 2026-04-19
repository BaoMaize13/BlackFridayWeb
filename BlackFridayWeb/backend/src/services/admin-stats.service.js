const { ORDER_STATUSES } = require("../constants/domain");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
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

class AdminStatsService {
  async getStats(filter = {}) {
    let product = null;

    if (filter.productId) {
      product = await productRepository.findProductById(filter.productId);

      if (!product) {
        throw createProductNotFoundError(filter.productId);
      }
    }

    const totalProducts = await productRepository.countProducts();
    const totalOrders = await orderRepository.countOrders({
      productId: filter.productId
    });
    const successOrders = await orderRepository.countOrders({
      productId: filter.productId,
      status: ORDER_STATUSES.SUCCESS
    });
    const failedOrders = await orderRepository.countOrders({
      productId: filter.productId,
      status: ORDER_STATUSES.FAILED
    });
    const totalAttemptLogs = await purchaseAttemptRepository.countAttemptLogs({
      productId: filter.productId
    });

    const successfulOrderedQuantity = product
      ? await orderRepository.sumSuccessfulOrderQuantityByProduct(product.id)
      : null;

    return {
      consistencyCheck: product
        ? {
            note: "Use current stock together with successful ordered quantity to analyze oversell in later phases.",
            productId: product.id,
            stockNonNegative: product.stock >= 0,
            successfulOrderCount: successOrders,
            successfulOrderedQuantity
          }
        : null,
      failedOrders,
      productStock: product ? product.stock : null,
      successOrders,
      totalAttemptLogs,
      totalOrders,
      totalProducts
    };
  }
}

module.exports = new AdminStatsService();
