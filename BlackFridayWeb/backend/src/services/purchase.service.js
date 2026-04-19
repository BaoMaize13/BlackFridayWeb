const { ORDER_FAILURE_REASONS, ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../constants/domain");
const { purchaseConfig, serverConfig } = require("../config");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const AppError = require("../utils/app-error");

const orderRepository = new OrderRepository();
const productRepository = new ProductRepository();
const purchaseAttemptRepository = new PurchaseAttemptRepository();

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createProductNotFoundError(productId) {
  return new AppError({
    message: `Product with id ${productId} was not found`,
    statusCode: HTTP_STATUS.NOT_FOUND,
    errorCode: ERROR_CODES.PRODUCT_NOT_FOUND
  });
}

function createOutOfStockError(productId, quantity) {
  return new AppError({
    message: `Product ${productId} does not have enough stock for quantity ${quantity}`,
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.OUT_OF_STOCK
  });
}

function createDuplicateRequestError(requestId) {
  return new AppError({
    message: `Request '${requestId}' has already been processed`,
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.DUPLICATE_REQUEST
  });
}

function isDuplicateRequestDatabaseError(error) {
  const message = String(error?.message || "");

  return (
    (error?.code === "SQLITE_CONSTRAINT" && message.includes("orders.request_id")) ||
    (error?.code === "23505" && (message.includes("orders_request_id") || message.includes("request_id")))
  );
}

class PurchaseService {
  async createAttemptLog(data) {
    return purchaseAttemptRepository.createAttemptLog({
      action: data.action,
      message: data.message,
      productId: data.productId ?? null,
      requestId: data.requestId,
      result: data.result,
      serverId: data.serverId,
      stockAfter: data.stockAfter,
      stockBefore: data.stockBefore
    });
  }

  async createOrderRecord(data) {
    try {
      return await orderRepository.createOrder({
        buyerRef: data.userId,
        failureReason: data.failureReason ?? null,
        productId: data.productId,
        quantity: data.quantity,
        requestId: data.requestId,
        status: data.status
      });
    } catch (error) {
      if (isDuplicateRequestDatabaseError(error)) {
        throw createDuplicateRequestError(data.requestId);
      }

      throw error;
    }
  }

  async purchaseWithoutLock(payload, context = {}) {
    const delayMs = purchaseConfig.noLockDelayMs;
    const logger = context.logger;
    const serverId = context.serverId || serverConfig.id;

    logger?.info(
      {
        action: "purchase.no_lock.started",
        delayMs,
        productId: payload.productId,
        purchaseRequestId: payload.requestId,
        quantity: payload.quantity,
        userId: payload.userId
      },
      "No-lock purchase flow started"
    );

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.PURCHASE_REQUEST_RECEIVED,
      message: `Purchase no-lock request received for requestedProductId=${payload.productId}, quantity=${payload.quantity}`,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId
    });

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_STARTED,
      message: `Purchase no-lock flow started for requestedProductId=${payload.productId}`,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId
    });

    const existingOrder = await orderRepository.findOrderByRequestId(payload.requestId);

    if (existingOrder) {
      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED,
        message: `Duplicate request detected before processing requestId=${payload.requestId}`,
        productId: existingOrder.productId ?? null,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId
      });

      logger?.warn(
        {
          action: "purchase.no_lock.duplicate_request",
          productId: payload.productId,
          purchaseRequestId: payload.requestId
        },
        "Duplicate purchase request rejected"
      );

      throw createDuplicateRequestError(payload.requestId);
    }

    const product = await productRepository.findProductById(payload.productId);

    if (!product) {
      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED,
        message: `Product not found for requestedProductId=${payload.productId}`,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId
      });

      logger?.warn(
        {
          action: "purchase.no_lock.product_not_found",
          productId: payload.productId,
          purchaseRequestId: payload.requestId
        },
        "No-lock purchase failed because product was not found"
      );

      throw createProductNotFoundError(payload.productId);
    }

    const stockBefore = product.stock;

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.PRODUCT_READ,
      message: `Product read with stock=${stockBefore}`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockBefore
    });

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.STOCK_READ,
      message: `Stock snapshot captured before no-lock delay. stock=${stockBefore}`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockBefore
    });

    if (stockBefore < payload.quantity) {
      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED,
        message: `Out of stock before delay. stock=${stockBefore}, quantity=${payload.quantity}`,
        productId: product.id,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId,
        stockBefore
      });

      const failedOrder = await this.createOrderRecord({
        failureReason: ORDER_FAILURE_REASONS.OUT_OF_STOCK,
        productId: product.id,
        quantity: payload.quantity,
        requestId: payload.requestId,
        status: ORDER_STATUSES.FAILED,
        userId: payload.userId
      });

      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
        message: `Failed order created because stock was insufficient`,
        productId: product.id,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId,
        stockBefore
      });

      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED,
        message: `Purchase no-lock failed because stock was insufficient`,
        productId: product.id,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId,
        stockBefore
      });

      logger?.warn(
        {
          action: "purchase.no_lock.out_of_stock",
          productId: product.id,
          purchaseRequestId: payload.requestId,
          quantity: payload.quantity,
          stockBefore
        },
        "No-lock purchase failed because stock was insufficient"
      );

      const error = createOutOfStockError(product.id, payload.quantity);
      error.details = {
        orderId: failedOrder.id,
        stockBefore
      };
      throw error;
    }

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED,
      message: `Stock check passed before delay. stock=${stockBefore}, quantity=${payload.quantity}`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockBefore
    });

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_STARTED,
      message: `Artificial delay started for ${delayMs}ms`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockBefore
    });

    logger?.info(
      {
        action: "purchase.no_lock.delay_started",
        delayMs,
        productId: product.id,
        purchaseRequestId: payload.requestId,
        stockBefore
      },
      "Artificial delay started for no-lock purchase"
    );

    await sleep(delayMs);

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_ENDED,
      message: `Artificial delay ended after ${delayMs}ms`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockBefore
    });

    const stockAfter = stockBefore - payload.quantity;
    const updatedProduct = await productRepository.updateProductStock(product.id, stockAfter);

    if (!updatedProduct) {
      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED,
        message: `Product row was not available when writing stale stock snapshot`,
        productId: product.id,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId,
        stockBefore
      });

      throw createProductNotFoundError(product.id);
    }

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
      message: `Stock updated using stale snapshot. stockBefore=${stockBefore}, stockAfter=${stockAfter}`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockAfter,
      stockBefore
    });

    let order;

    try {
      order = await this.createOrderRecord({
        productId: product.id,
        quantity: payload.quantity,
        requestId: payload.requestId,
        status: ORDER_STATUSES.SUCCESS,
        userId: payload.userId
      });
    } catch (error) {
      await this.createAttemptLog({
        action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED,
        message: `Purchase no-lock failed while creating success order: ${error.message}`,
        productId: product.id,
        requestId: payload.requestId,
        result: PURCHASE_LOG_RESULTS.FAILED,
        serverId,
        stockAfter,
        stockBefore
      });

      throw error;
    }

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.ORDER_CREATED,
      message: `Success order created after stale-stock update`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockAfter,
      stockBefore
    });

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS,
      message: `Purchase no-lock flow completed successfully`,
      productId: product.id,
      requestId: payload.requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId,
      stockAfter,
      stockBefore
    });

    logger?.info(
      {
        action: "purchase.no_lock.success",
        delayMs,
        orderId: order.id,
        productId: product.id,
        purchaseRequestId: payload.requestId,
        quantity: payload.quantity,
        stockAfter,
        stockBefore
      },
      "No-lock purchase flow completed"
    );

    return {
      delayMs,
      order,
      product: updatedProduct,
      quantity: payload.quantity,
      requestId: payload.requestId,
      stockAfter,
      stockBefore
    };
  }
}

module.exports = new PurchaseService();
