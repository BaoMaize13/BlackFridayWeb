const { performance } = require("node:perf_hooks");

const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const purchaseService = require("../services/purchase.service");
const { validatePurchaseNoLockBody, validatePurchaseWithLockBody } = require("../validators/purchase.validator");

function getTimestamp() {
  return new Date().toISOString();
}

function getDurationMs(startedAtMs) {
  return Number((performance.now() - startedAtMs).toFixed(2));
}

function getErrorReason(error) {
  return error?.errorCode || ERROR_CODES.INTERNAL_ERROR;
}

function buildSuccessResponse(req, result, mode, startedAtMs) {
  const stockBefore = result.stockBefore ?? result.stock?.before ?? null;
  const stockAfter = result.stockAfter ?? result.stock?.after ?? result.product?.stock ?? result.updatedProduct?.stock ?? null;
  const productId = result.product?.id ?? result.updatedProduct?.id ?? result.order?.productId ?? result.productId ?? null;
  const quantity = result.quantity ?? result.order?.quantity ?? null;

  return {
    success: true,
    mode,
    productId,
    quantity,
    stockBefore,
    stockAfter,
    message: "Purchase successful",
    reason: null,
    requestId: result.requestId ?? req.context?.requestId ?? null,
    serverInstanceId: req.context?.serverId ?? null,
    timestamp: getTimestamp(),
    durationMs: getDurationMs(startedAtMs),
    lock: result.lock ?? null,
    order: result.order ?? null,
    data: result,
    meta: {
      requestId: req.context?.requestId ?? null,
      serverId: req.context?.serverId ?? null,
      timestamp: getTimestamp()
    }
  };
}

function buildFailureResponse(req, error, mode, payload, startedAtMs) {
  const reason = getErrorReason(error);
  const details = error?.details || {};
  const stockBefore = details.stockBefore ?? details.stock ?? null;
  const stockAfter = details.stockAfter ?? stockBefore;

  return {
    success: false,
    mode,
    productId: details.productId ?? payload.productId ?? null,
    quantity: payload.quantity ?? details.requestedQuantity ?? null,
    stockBefore,
    stockAfter,
    reason,
    message:
      reason === ERROR_CODES.LOCK_TIMEOUT
        ? "Could not acquire lock"
        : reason === ERROR_CODES.OUT_OF_STOCK
          ? "Insufficient stock"
          : error?.message || "Purchase failed",
    requestId: payload.requestId ?? req.context?.requestId ?? null,
    serverInstanceId: req.context?.serverId ?? null,
    timestamp: getTimestamp(),
    durationMs: getDurationMs(startedAtMs),
    error: {
      code: reason,
      details
    },
    meta: {
      requestId: req.context?.requestId ?? null,
      serverId: req.context?.serverId ?? null,
      timestamp: getTimestamp(),
      path: req.originalUrl
    }
  };
}

function sendPurchaseSuccess(res, req, result, mode, startedAtMs) {
  return res.status(HTTP_STATUS.OK).json(buildSuccessResponse(req, result, mode, startedAtMs));
}

function sendPurchaseFailure(res, req, error, mode, payload, startedAtMs) {
  const statusCode = error?.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return res.status(statusCode).json(buildFailureResponse(req, error, mode, payload, startedAtMs));
}

async function purchaseWithoutLock(req, res, next) {
  const startedAtMs = performance.now();
  let payload;

  try {
    payload = validatePurchaseNoLockBody(req.body);
    const result = await purchaseService.purchaseWithoutLock(payload, {
      logger: req.context?.logger,
      requestId: req.context?.requestId,
      serverId: req.context?.serverId
    });

    return sendPurchaseSuccess(res, req, result, "NO_LOCK", startedAtMs);
  } catch (error) {
    if (error?.statusCode && error.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      return sendPurchaseFailure(res, req, error, "NO_LOCK", payload || req.body || {}, startedAtMs);
    }

    return next(error);
  }
}

async function purchaseWithLock(req, res, next) {
  const startedAtMs = performance.now();
  let payload;

  try {
    payload = validatePurchaseWithLockBody(req.body);
    const result = await purchaseService.purchaseWithLock(payload, {
      logger: req.context?.logger,
      requestId: req.context?.requestId,
      serverId: req.context?.serverId
    });

    return sendPurchaseSuccess(res, req, result, "WITH_LOCK", startedAtMs);
  } catch (error) {
    if (error?.statusCode && error.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      return sendPurchaseFailure(res, req, error, "WITH_LOCK", payload || req.body || {}, startedAtMs);
    }

    return next(error);
  }
}

async function purchaseOptimisticLock(req, res, next) {
  const startedAtMs = performance.now();
  let payload;

  try {
    payload = validatePurchaseWithLockBody(req.body);
    const result = await purchaseService.purchaseWithLock(payload, {
      logger: req.context?.logger,
      requestId: req.context?.requestId,
      serverId: req.context?.serverId
    });

    return sendPurchaseSuccess(res, req, result, "OPTIMISTIC_LOCK", startedAtMs);
  } catch (error) {
    if (error?.statusCode && error.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      return sendPurchaseFailure(res, req, error, "OPTIMISTIC_LOCK", payload || req.body || {}, startedAtMs);
    }

    return next(error);
  }
}

module.exports = {
  buildFailureResponse,
  buildSuccessResponse,
  purchaseOptimisticLock,
  purchaseWithoutLock,
  purchaseWithLock
};
