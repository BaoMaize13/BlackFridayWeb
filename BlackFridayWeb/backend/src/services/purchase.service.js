const {
  ORDER_FAILURE_REASONS,
  ORDER_STATUSES,
  PURCHASE_LOG_ACTIONS,
  PURCHASE_LOG_RESULTS,
  PURCHASE_RESULTS
} = require("../constants/domain");
const { randomUUID } = require("node:crypto");
const { purchaseConfig, serverConfig } = require("../config");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { withTransaction } = require("../database/client");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const lockService = require("./lock.service");
const AppError = require("../utils/app-error");
const { buildProductLockKey } = require("../utils/lock-key.util");
const { sleep } = require("../utils/sleep.util");

const orderRepository = new OrderRepository();
const productRepository = new ProductRepository();
const purchaseAttemptRepository = new PurchaseAttemptRepository();

function formatOrderForResponse(order) {
  return {
    id: order.id,
    productId: order.productId,
    quantity: order.quantity,
    requestId: order.requestId,
    status: order.status,
    userId: order.buyerRef
  };
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
    message: "Product is out of stock.",
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.OUT_OF_STOCK,
    details: {
      productId,
      requestedQuantity: quantity
    }
  });
}

function createDuplicateRequestError(requestId) {
  return new AppError({
    message: `Request '${requestId}' has already been processed`,
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.DUPLICATE_REQUEST
  });
}

function createLockTimeoutError(productId, lockKey) {
  return new AppError({
    message: "Could not acquire product lock before timeout.",
    statusCode: HTTP_STATUS.CONFLICT,
    errorCode: ERROR_CODES.LOCK_TIMEOUT,
    details: {
      lockKey,
      productId
    }
  });
}

function createLockServiceUnavailableError(productId, lockKey) {
  return new AppError({
    message: "Distributed lock service is unavailable.",
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
    errorCode: ERROR_CODES.LOCK_SERVICE_UNAVAILABLE,
    details: {
      lockKey,
      productId
    }
  });
}

function resolveNoLockDelayMs(payload = {}) {
  if (Number.isInteger(payload.artificialDelayMs) && payload.artificialDelayMs >= 0) {
    return payload.artificialDelayMs;
  }

  if (Number.isInteger(purchaseConfig.noLockFixedDelayMs) && purchaseConfig.noLockFixedDelayMs > 0) {
    return purchaseConfig.noLockFixedDelayMs;
  }

  const minDelayMs = Math.max(0, Number(purchaseConfig.noLockDelayMinMs) || 20);
  const maxDelayMs = Math.max(minDelayMs, Number(purchaseConfig.noLockDelayMaxMs) || 200);

  return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}

function normalizePurchasePayload(payload = {}, context = {}) {
  return {
    ...payload,
    requestId: payload.requestId || context.requestId || randomUUID(),
    userId: payload.userId || "demo-user"
  };
}

function isDuplicateRequestDatabaseError(error) {
  const message = String(error?.message || "");

  return (
    (error?.code === "SQLITE_CONSTRAINT" && message.includes("orders.request_id")) ||
    (error?.code === "23505" && (message.includes("orders_request_id") || message.includes("request_id")))
  );
}

class PurchaseService {
  async createAttemptLog(data, options = {}) {
    return purchaseAttemptRepository.createAttemptLog({
      action: data.action,
      message: data.message,
      productId: data.productId ?? null,
      requestId: data.requestId,
      result: data.result,
      serverId: data.serverId,
      stockAfter: data.stockAfter,
      stockBefore: data.stockBefore
    }, options);
  }

  async createOrderRecord(data, options = {}) {
    try {
      return await orderRepository.createOrder({
        buyerRef: data.userId,
        failureReason: data.failureReason ?? null,
        productId: data.productId,
        quantity: data.quantity,
        requestId: data.requestId,
        status: data.status
      }, options);
    } catch (error) {
      if (isDuplicateRequestDatabaseError(error)) {
        throw createDuplicateRequestError(data.requestId);
      }

      throw error;
    }
  }

  async purchaseWithLock(payload, context = {}) {
    payload = normalizePurchasePayload(payload, context);
    const logger = context.logger;
    const requestId = payload.requestId;
    const serverId = context.serverId || serverConfig.id;
    const lockKey = buildProductLockKey(payload.productId);
    const lockContext = {
      acquired: false,
      key: lockKey,
      retryCount: 0,
      releaseStatus: null,
      token: null,
      waitMs: 0
    };

    logger?.info(
      {
        action: "purchase.with_lock.started",
        lockKey,
        productId: payload.productId,
        purchaseRequestId: requestId,
        quantity: payload.quantity,
        userId: payload.userId
      },
      "With-lock purchase flow started"
    );

    await this.createAttemptLog({
      action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_STARTED,
      message: `Purchase with-lock request received for productId=${payload.productId}, quantity=${payload.quantity}`,
      productId: null,
      requestId,
      result: PURCHASE_LOG_RESULTS.SUCCESS,
      serverId
    });

    try {
      const lockResult = await lockService.withLock(
        lockKey,
        async () =>
          withTransaction(async (transaction) => {
            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.LOCK_ACQUIRED_FOR_PURCHASE,
              message: `Distributed lock acquired for purchase lockKey=${lockKey}`,
              productId: null,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId
            }, {
              executor: transaction
            });

            const existingOrder = await orderRepository.findOrderByRequestId(requestId, {
              executor: transaction
            });

            if (existingOrder) {
              await this.createAttemptLog({
                action: PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED,
                message: `Duplicate request detected and short-circuited for requestId=${requestId}`,
                productId: existingOrder.productId,
                requestId,
                result: PURCHASE_LOG_RESULTS.SKIPPED,
                serverId
              }, {
                executor: transaction
              });

              logger?.warn(
                {
                  action: "purchase.with_lock.duplicate",
                  lockKey,
                  orderId: existingOrder.id,
                  productId: existingOrder.productId,
                  purchaseRequestId: requestId
                },
                "Duplicate with-lock purchase request returned existing order"
              );

              return {
                isDuplicate: true,
                lock: {
                  acquired: true,
                  key: lockKey,
                  retryCount: lockContext.retryCount,
                  releaseStatus: lockContext.releaseStatus,
                  token: lockContext.token,
                  waitMs: lockContext.waitMs
                },
                order: formatOrderForResponse(existingOrder),
                requestId,
                result: PURCHASE_RESULTS.SUCCESS,
                stock: null
              };
            }

            const product = await productRepository.findProductById(payload.productId, {
              executor: transaction
            });

            if (!product) {
              await this.createAttemptLog({
                action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED,
                message: `Product not found for productId=${payload.productId}`,
                productId: null,
                requestId,
                result: PURCHASE_LOG_RESULTS.FAILED,
                serverId
              }, {
                executor: transaction
              });

              return {
                failure: {
                  details: {
                    productId: payload.productId
                  },
                  errorCode: ERROR_CODES.PRODUCT_NOT_FOUND,
                  message: `Product with id ${payload.productId} was not found`,
                  statusCode: HTTP_STATUS.NOT_FOUND
                }
              };
            }

            const stockBefore = product.stock;

            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.PRODUCT_READ_WITH_LOCK,
              message: `Product read inside lock with stock=${stockBefore}`,
              productId: product.id,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId,
              stockBefore
            }, {
              executor: transaction
            });

            if (stockBefore < payload.quantity) {
              const failedOrder = await this.createOrderRecord({
                failureReason: ORDER_FAILURE_REASONS.OUT_OF_STOCK,
                productId: product.id,
                quantity: payload.quantity,
                requestId,
                status: ORDER_STATUSES.FAILED,
                userId: payload.userId
              }, {
                executor: transaction
              });

              await this.createAttemptLog({
                action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED_WITH_LOCK,
                message: `Stock check failed inside lock. stock=${stockBefore}, quantity=${payload.quantity}`,
                productId: product.id,
                requestId,
                result: PURCHASE_LOG_RESULTS.FAILED,
                serverId,
                stockBefore
              }, {
                executor: transaction
              });

              await this.createAttemptLog({
                action: PURCHASE_LOG_ACTIONS.ORDER_CREATED_WITH_LOCK,
                message: "Failed order created due to out-of-stock",
                productId: product.id,
                requestId,
                result: PURCHASE_LOG_RESULTS.FAILED,
                serverId,
                stockBefore
              }, {
                executor: transaction
              });

              await this.createAttemptLog({
                action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED,
                message: `Purchase with-lock failed because stock was insufficient for quantity=${payload.quantity}`,
                productId: product.id,
                requestId,
                result: PURCHASE_LOG_RESULTS.FAILED,
                serverId,
                stockBefore
              }, {
                executor: transaction
              });

              return {
                failure: {
                  details: {
                    orderId: failedOrder.id,
                    productId: product.id,
                    requestedQuantity: payload.quantity,
                    stock: stockBefore
                  },
                  errorCode: ERROR_CODES.OUT_OF_STOCK,
                  message: "Product is out of stock.",
                  statusCode: HTTP_STATUS.CONFLICT
                }
              };
            }

            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED_WITH_LOCK,
              message: `Stock check passed inside lock. stock=${stockBefore}, quantity=${payload.quantity}`,
              productId: product.id,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId,
              stockBefore
            }, {
              executor: transaction
            });

            const stockAfter = stockBefore - payload.quantity;
            const updatedProduct = await productRepository.updateProductStock(product.id, stockAfter, {
              executor: transaction,
              expectedVersion: product.version
            });

            if (!updatedProduct) {
              throw new AppError({
                message: "Product stock update conflict detected.",
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: ERROR_CODES.CONFLICT
              });
            }

            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.STOCK_UPDATED_WITH_LOCK,
              message: `Stock updated inside lock. stockBefore=${stockBefore}, stockAfter=${stockAfter}`,
              productId: product.id,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId,
              stockAfter,
              stockBefore
            }, {
              executor: transaction
            });

            const order = await this.createOrderRecord({
              productId: product.id,
              quantity: payload.quantity,
              requestId,
              status: ORDER_STATUSES.SUCCESS,
              userId: payload.userId
            }, {
              executor: transaction
            });

            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.ORDER_CREATED_WITH_LOCK,
              message: "Success order created inside lock",
              productId: product.id,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId,
              stockAfter,
              stockBefore
            }, {
              executor: transaction
            });

            await this.createAttemptLog({
              action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_SUCCESS,
              message: "Purchase with-lock flow completed successfully",
              productId: product.id,
              requestId,
              result: PURCHASE_LOG_RESULTS.SUCCESS,
              serverId,
              stockAfter,
              stockBefore
            }, {
              executor: transaction
            });

            logger?.info(
              {
                action: "purchase.with_lock.success",
                lockKey,
                orderId: order.id,
                productId: product.id,
                purchaseRequestId: requestId,
                quantity: payload.quantity,
                stockAfter,
                stockBefore
              },
              "With-lock purchase flow completed"
            );

            return {
              isDuplicate: false,
              lock: {
                acquired: true,
                key: lockKey,
                retryCount: lockContext.retryCount,
                releaseStatus: lockContext.releaseStatus,
                token: lockContext.token,
                waitMs: lockContext.waitMs
              },
              order: formatOrderForResponse(order),
              requestId,
              result: PURCHASE_RESULTS.SUCCESS,
              stock: {
                after: stockAfter,
                before: stockBefore
              },
              updatedProduct
            };
          }),
        {
          logger,
          metadata: {
            productId: payload.productId,
            quantity: payload.quantity,
            userId: payload.userId
          },
          requestId,
          serverId,
          onLockAcquired(lock) {
            lockContext.acquired = true;
            lockContext.retryCount = Math.max(0, (lock.attempts || 1) - 1);
            lockContext.token = lock.token;
            lockContext.waitMs = lock.elapsedMs || 0;
          },
          onLockReleased(releaseResult) {
            lockContext.releaseStatus = releaseResult?.released ? "RELEASED" : "SKIPPED";
          }
        }
      );

      if (lockResult?.lock) {
        lockResult.lock.retryCount = lockContext.retryCount;
        lockResult.lock.releaseStatus = lockContext.releaseStatus;
        lockResult.lock.token = lockContext.token;
        lockResult.lock.waitMs = lockContext.waitMs;
      }

      if (lockResult?.failure) {
        throw new AppError(lockResult.failure);
      }

      return lockResult;
    } catch (error) {
      if (error?.errorCode === ERROR_CODES.LOCK_TIMEOUT) {
        await this.createAttemptLog({
          action: PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE,
          message: `Lock timeout while waiting to purchase productId=${payload.productId}`,
          productId: null,
          requestId,
          result: PURCHASE_LOG_RESULTS.FAILED,
          serverId
        });

        throw createLockTimeoutError(payload.productId, lockKey);
      }

      if (error?.errorCode === ERROR_CODES.LOCK_SERVICE_UNAVAILABLE) {
        await this.createAttemptLog({
          action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED,
          message: `Lock service unavailable during purchase: ${error.message}`,
          productId: null,
          requestId,
          result: PURCHASE_LOG_RESULTS.FAILED,
          serverId
        });

        throw createLockServiceUnavailableError(payload.productId, lockKey);
      }

      if (error?.errorCode !== ERROR_CODES.OUT_OF_STOCK && error?.errorCode !== ERROR_CODES.PRODUCT_NOT_FOUND) {
        await this.createAttemptLog({
          action: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED,
          message: `Purchase with-lock failed: ${error.message}`,
          productId: null,
          requestId,
          result: PURCHASE_LOG_RESULTS.FAILED,
          serverId
        });
      }

      throw error;
    }
  }

  async purchaseWithoutLock(payload, context = {}) {
    payload = normalizePurchasePayload(payload, context);
    const delayMs = resolveNoLockDelayMs(payload);
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
        productId: product.id,
        requestedQuantity: payload.quantity,
        stockAfter: stockBefore,
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
