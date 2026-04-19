const { PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../constants/domain");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const {
  calculateBusinessMetrics,
  calculateConsistencyCheck,
  calculateOrderMetrics,
  calculateServerDistribution,
  calculateStockMetrics
} = require("../utils/metrics.util");
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

function buildBaseFilter(filter = {}) {
  if (filter.productId) {
    return {
      productId: filter.productId
    };
  }

  return {};
}

class AdminMetricsService {
  async getMetrics(filter = {}) {
    const baseFilter = buildBaseFilter(filter);
    let product = null;

    if (filter.productId) {
      product = await productRepository.findProductById(filter.productId);

      if (!product) {
        throw createProductNotFoundError(filter.productId);
      }
    }

    const orders = await orderRepository.listOrders(baseFilter);
    const totalAttemptLogs = await purchaseAttemptRepository.countAttemptLogs(baseFilter);
    const needsFullLogs = filter.includeLogs || filter.includeServerBreakdown;
    const attemptLogs = needsFullLogs
      ? await purchaseAttemptRepository.listAttemptLogs(baseFilter)
      : [];
    const failedAttemptLogs = needsFullLogs
      ? attemptLogs.filter((attemptLog) => attemptLog.result === PURCHASE_LOG_RESULTS.FAILED)
      : await purchaseAttemptRepository.listAttemptLogs({
          ...baseFilter,
          result: PURCHASE_LOG_RESULTS.FAILED
        });

    const [
      noLockStockCheckFailedCount,
      withLockStockCheckFailedCount,
      lockTimeoutActionCount,
      duplicateDetectedActionCount
    ] = await Promise.all([
      purchaseAttemptRepository.countAttemptLogs({
        ...baseFilter,
        action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED
      }),
      purchaseAttemptRepository.countAttemptLogs({
        ...baseFilter,
        action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED_WITH_LOCK
      }),
      purchaseAttemptRepository.countAttemptLogs({
        ...baseFilter,
        action: PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE
      }),
      purchaseAttemptRepository.countAttemptLogs({
        ...baseFilter,
        action: PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED
      })
    ]);

    const orderMetrics = calculateOrderMetrics(orders);
    const businessMetrics = calculateBusinessMetrics({
      attemptLogs: needsFullLogs ? attemptLogs : failedAttemptLogs,
      orders,
      requestResults: []
    });
    const stockMetrics = calculateStockMetrics({
      afterProduct: product,
      initialStock: filter.initialStock,
      quantity: filter.quantity,
      successOrders: orderMetrics.successOrders
    });
    const consistencyCheck = calculateConsistencyCheck(
      stockMetrics.initialStock,
      stockMetrics.finalStock,
      orderMetrics.successOrders,
      filter.quantity
    );
    const serverMetrics = filter.includeServerBreakdown
      ? calculateServerDistribution({
          attemptLogs,
          orders,
          requestResults: []
        })
      : {
          failedOrdersByServerId: {},
          limitations: ["Server breakdown was not requested. Set includeServerBreakdown=true to include it."],
          logDistribution: {},
          requestDistribution: {},
          responseServerDistribution: {},
          serverBreakdown: {},
          successOrdersByServerId: {}
        };

    return {
      attemptLogs: {
        items: filter.includeLogs ? attemptLogs : undefined,
        total: totalAttemptLogs
      },
      consistencyCheck,
      errors: {
        duplicateRequest: Math.max(businessMetrics.duplicateRequestCount, duplicateDetectedActionCount),
        lockServiceUnavailable: businessMetrics.lockServiceUnavailableCount,
        lockTimeout: Math.max(businessMetrics.lockTimeoutCount, lockTimeoutActionCount),
        outOfStock: Math.max(
          businessMetrics.outOfStockCount,
          noLockStockCheckFailedCount + withLockStockCheckFailedCount
        ),
        productNotFound: businessMetrics.productNotFoundCount,
        validationError: businessMetrics.validationErrorCount
      },
      includeLogs: filter.includeLogs,
      includeServerBreakdown: filter.includeServerBreakdown,
      limitations: [
        ...(consistencyCheck.note ? [consistencyCheck.note] : []),
        ...serverMetrics.limitations
      ],
      orders: {
        byFailureReason: orderMetrics.ordersByFailureReason,
        byStatus: orderMetrics.ordersByStatus,
        failed: orderMetrics.failedOrders,
        success: orderMetrics.successOrders,
        total: orderMetrics.totalOrders
      },
      productCode: product?.code ?? null,
      productId: product?.id ?? filter.productId ?? null,
      productName: product?.name ?? null,
      requestDistribution: filter.includeServerBreakdown ? serverMetrics.requestDistribution : null,
      responseServerDistribution: filter.includeServerBreakdown ? serverMetrics.responseServerDistribution : null,
      serverBreakdown: filter.includeServerBreakdown ? serverMetrics.serverBreakdown : null,
      serverLogDistribution: filter.includeServerBreakdown ? serverMetrics.logDistribution : null,
      stock: product?.stock ?? null,
      stockMetrics,
      successOrdersByServerId: filter.includeServerBreakdown ? serverMetrics.successOrdersByServerId : null,
      failedOrdersByServerId: filter.includeServerBreakdown ? serverMetrics.failedOrdersByServerId : null
    };
  }
}

module.exports = new AdminMetricsService();
