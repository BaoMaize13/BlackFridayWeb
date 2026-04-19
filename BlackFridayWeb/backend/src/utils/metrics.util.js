const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../constants/domain");

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundMetric(value) {
  if (!isFiniteNumber(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

function aggregateCounts(values = []) {
  return normalizeArray(values)
    .filter((value) => value !== undefined && value !== null && value !== "")
    .reduce((accumulator, value) => {
      accumulator[value] = (accumulator[value] || 0) + 1;
      return accumulator;
    }, {});
}

function sumNumericValues(values = []) {
  return normalizeArray(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0);
}

function percentile(values = [], fraction = 0.95) {
  const normalizedValues = normalizeArray(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((leftValue, rightValue) => leftValue - rightValue);

  if (normalizedValues.length === 0) {
    return 0;
  }

  const index = Math.max(0, Math.ceil(fraction * normalizedValues.length) - 1);
  return roundMetric(normalizedValues[index]);
}

function pickLargestCount(...values) {
  const numericValues = values
    .flat()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length === 0) {
    return 0;
  }

  return Math.max(...numericValues);
}

function normalizeMode(mode) {
  if (typeof mode !== "string") {
    return "unknown";
  }

  const normalizedValue = mode.trim().toLowerCase();

  if (normalizedValue === "no-lock" || normalizedValue === "with-lock") {
    return normalizedValue;
  }

  return "unknown";
}

function inferModeFromInput(input = {}) {
  if (normalizeMode(input.mode) !== "unknown") {
    return normalizeMode(input.mode);
  }

  const endpointPath = String(input.config?.endpointPath || "").trim().toLowerCase();

  if (endpointPath.includes("/purchase/no-lock")) {
    return "no-lock";
  }

  if (endpointPath.includes("/purchase/with-lock")) {
    return "with-lock";
  }

  const testName = String(input.testName || "").trim().toUpperCase();

  if (testName.includes("NO_LOCK")) {
    return "no-lock";
  }

  if (testName.includes("WITH_LOCK")) {
    return "with-lock";
  }

  return "unknown";
}

function normalizeBaseUrls(config = {}) {
  if (Array.isArray(config.baseUrls) && config.baseUrls.length > 0) {
    return [...new Set(config.baseUrls)];
  }

  if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
    return [config.baseUrl.trim()];
  }

  return [];
}

function calculateLatencyMetrics(requestResults = []) {
  const normalizedResults = normalizeArray(requestResults);
  const durations = normalizedResults
    .map((requestResult) => Number(requestResult?.durationMs))
    .filter((value) => Number.isFinite(value))
    .sort((leftValue, rightValue) => leftValue - rightValue);
  const httpSuccessResponses = normalizedResults.filter((requestResult) => requestResult?.responseSuccess === true).length;
  const totalRequests = normalizedResults.length;

  return {
    averageLatencyMs:
      durations.length > 0 ? roundMetric(sumNumericValues(durations) / durations.length) : 0,
    httpFailedResponses: totalRequests - httpSuccessResponses,
    httpSuccessResponses,
    maxLatencyMs: durations.length > 0 ? roundMetric(durations[durations.length - 1]) : 0,
    minLatencyMs: durations.length > 0 ? roundMetric(durations[0]) : 0,
    networkFailures: normalizedResults.filter((requestResult) => Boolean(requestResult?.transportError)).length,
    p95LatencyMs: percentile(durations, 0.95),
    totalRequests
  };
}

function calculateOrderMetrics(orders = []) {
  const normalizedOrders = normalizeArray(orders);
  const ordersByStatus = aggregateCounts(normalizedOrders.map((order) => order?.status || "UNKNOWN"));
  const ordersByFailureReason = aggregateCounts(normalizedOrders.map((order) => order?.failureReason).filter(Boolean));
  const successOrders = ordersByStatus[ORDER_STATUSES.SUCCESS] || 0;
  const failedOrders = ordersByStatus[ORDER_STATUSES.FAILED] || 0;

  return {
    failedOrders,
    ordersByFailureReason,
    ordersByStatus,
    successOrders,
    successfulOrderedQuantity: sumNumericValues(
      normalizedOrders
        .filter((order) => order?.status === ORDER_STATUSES.SUCCESS)
        .map((order) => order?.quantity)
    ),
    totalOrders: normalizedOrders.length,
    totalOrderedQuantity: sumNumericValues(normalizedOrders.map((order) => order?.quantity))
  };
}

function countFailedMessages(attemptLogs = [], matcher) {
  return normalizeArray(attemptLogs).filter((attemptLog) => {
    if (!matcher || typeof matcher !== "function") {
      return false;
    }

    const message = String(attemptLog?.message || "").toLowerCase();
    return matcher(message, attemptLog);
  }).length;
}

function extractErrorCodeBreakdown(requestResults = []) {
  const normalizedResults = normalizeArray(requestResults);
  const errorCodes = normalizedResults
    .map((requestResult) => requestResult?.errorCode)
    .filter(Boolean);

  if (normalizedResults.some((requestResult) => requestResult?.transportError)) {
    errorCodes.push(...normalizedResults.filter((requestResult) => requestResult?.transportError).map(() => "NETWORK_ERROR"));
  }

  return aggregateCounts(errorCodes);
}

function extractActionBreakdown(attemptLogs = []) {
  return aggregateCounts(normalizeArray(attemptLogs).map((attemptLog) => attemptLog?.action).filter(Boolean));
}

function calculateBusinessMetrics(input = {}) {
  const requestResults = normalizeArray(input.requestResults);
  const orders = normalizeArray(input.orders);
  const attemptLogs = normalizeArray(input.attemptLogs);
  const orderMetrics = calculateOrderMetrics(orders);
  const errorCodeBreakdown = extractErrorCodeBreakdown(requestResults);
  const actionBreakdown = extractActionBreakdown(attemptLogs);
  const orderFailureReasonBreakdown = orderMetrics.ordersByFailureReason;

  const outOfStockCount = pickLargestCount(
    errorCodeBreakdown.OUT_OF_STOCK,
    orderFailureReasonBreakdown.OUT_OF_STOCK,
    (actionBreakdown[PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED] || 0) +
      (actionBreakdown[PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED_WITH_LOCK] || 0)
  );
  const lockTimeoutCount = pickLargestCount(
    errorCodeBreakdown.LOCK_TIMEOUT,
    orderFailureReasonBreakdown.LOCK_TIMEOUT,
    actionBreakdown[PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE]
  );
  const lockServiceUnavailableCount = pickLargestCount(
    errorCodeBreakdown.LOCK_SERVICE_UNAVAILABLE,
    countFailedMessages(attemptLogs, (message) => message.includes("lock service unavailable"))
  );
  const productNotFoundCount = pickLargestCount(
    errorCodeBreakdown.PRODUCT_NOT_FOUND,
    orderFailureReasonBreakdown.PRODUCT_NOT_FOUND,
    countFailedMessages(attemptLogs, (message) => message.includes("product not found"))
  );
  const duplicateRequestCount = pickLargestCount(
    errorCodeBreakdown.DUPLICATE_REQUEST,
    orderFailureReasonBreakdown.DUPLICATE_REQUEST,
    actionBreakdown[PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED]
  );
  const validationErrorCount = pickLargestCount(
    errorCodeBreakdown.VALIDATION_ERROR,
    orderFailureReasonBreakdown.VALIDATION_ERROR
  );

  return {
    actionBreakdown,
    duplicateRequestCount,
    errorCodeBreakdown,
    failedOrders: orderMetrics.failedOrders,
    lockServiceUnavailableCount,
    lockTimeoutCount,
    networkErrorCount: errorCodeBreakdown.NETWORK_ERROR || 0,
    orderFailureReasonBreakdown,
    outOfStockCount,
    productNotFoundCount,
    successOrders: orderMetrics.successOrders,
    totalOrders: orderMetrics.totalOrders,
    validationErrorCount
  };
}

function calculateConsistencyCheck(initialStock, finalStock, successOrders, quantity) {
  const normalizedInitialStock = Number(initialStock);
  const normalizedFinalStock = Number(finalStock);
  const normalizedSuccessOrders = Number(successOrders);
  const normalizedQuantity = Number(quantity);
  const canComputeFullCheck =
    Number.isInteger(normalizedInitialStock) &&
    normalizedInitialStock >= 0 &&
    Number.isInteger(normalizedSuccessOrders) &&
    normalizedSuccessOrders >= 0 &&
    Number.isInteger(normalizedQuantity) &&
    normalizedQuantity > 0;
  const negativeStockDetected = Number.isFinite(normalizedFinalStock) ? normalizedFinalStock < 0 : null;

  if (!canComputeFullCheck) {
    return {
      dataConsistent: Number.isFinite(normalizedFinalStock) ? normalizedFinalStock >= 0 : null,
      expectedFinalStock: null,
      maxSuccessOrders: null,
      negativeStockDetected,
      note: "initialStock and quantity are required to compute the full consistency check.",
      oversellDetected: null,
      stockMismatch: null
    };
  }

  const maxSuccessOrders = Math.floor(normalizedInitialStock / normalizedQuantity);
  const expectedFinalStock = normalizedInitialStock - normalizedSuccessOrders * normalizedQuantity;
  const oversellDetected = normalizedSuccessOrders > maxSuccessOrders;
  const stockMismatch = Number.isFinite(normalizedFinalStock) ? normalizedFinalStock !== expectedFinalStock : null;
  const dataConsistent = Number.isFinite(normalizedFinalStock)
    ? oversellDetected !== true && negativeStockDetected !== true && stockMismatch !== true
    : null;

  return {
    dataConsistent,
    expectedFinalStock,
    maxSuccessOrders,
    negativeStockDetected,
    note: Number.isFinite(normalizedFinalStock) ? null : "Final stock is unavailable; stock mismatch could not be evaluated.",
    oversellDetected,
    stockMismatch
  };
}

function calculateStockMetrics(input = {}) {
  const initialStock = isFiniteNumber(input.initialStock)
    ? input.initialStock
    : isFiniteNumber(input.beforeProduct?.stock)
      ? input.beforeProduct.stock
      : null;
  const finalStock = isFiniteNumber(input.afterProduct?.stock) ? input.afterProduct.stock : null;
  const consistencyCheck = calculateConsistencyCheck(initialStock, finalStock, input.successOrders, input.quantity);

  return {
    expectedFinalStock: consistencyCheck.expectedFinalStock,
    finalStock,
    initialStock
  };
}

function buildRequestIdToServerIdMap(requestResults = [], attemptLogs = []) {
  const requestIdToServerIdMap = {};

  normalizeArray(attemptLogs).forEach((attemptLog) => {
    if (attemptLog?.requestId && attemptLog?.serverId && !requestIdToServerIdMap[attemptLog.requestId]) {
      requestIdToServerIdMap[attemptLog.requestId] = attemptLog.serverId;
    }
  });

  normalizeArray(requestResults).forEach((requestResult) => {
    if (requestResult?.requestId && requestResult?.responseMetaServerId) {
      requestIdToServerIdMap[requestResult.requestId] = requestResult.responseMetaServerId;
    }
  });

  return requestIdToServerIdMap;
}

function ensureServerBucket(serverBreakdown, serverId) {
  const normalizedServerId = serverId || "UNKNOWN";

  serverBreakdown[normalizedServerId] = serverBreakdown[normalizedServerId] || {
    failedOrders: 0,
    httpFailedResponses: 0,
    httpResponses: 0,
    httpSuccessResponses: 0,
    logs: 0,
    successOrders: 0
  };

  return serverBreakdown[normalizedServerId];
}

function calculateServerDistribution(input = {}) {
  const requestResults = normalizeArray(input.requestResults);
  const attemptLogs = normalizeArray(input.attemptLogs);
  const orders = normalizeArray(input.orders);
  const requestDistribution = {};
  const responseServerDistribution = {};
  const logDistribution = {};
  const successOrdersByServerId = {};
  const failedOrdersByServerId = {};
  const serverBreakdown = {};
  const limitations = [];
  const defaultTargetBaseUrl = typeof input.defaultTargetBaseUrl === "string" ? input.defaultTargetBaseUrl : null;
  const requestIdToServerIdMap = buildRequestIdToServerIdMap(requestResults, attemptLogs);

  requestResults.forEach((requestResult) => {
    const targetBaseUrl = requestResult?.targetBaseUrl || defaultTargetBaseUrl;

    if (targetBaseUrl) {
      requestDistribution[targetBaseUrl] = (requestDistribution[targetBaseUrl] || 0) + 1;
    }

    if (requestResult?.responseMetaServerId) {
      const serverId = requestResult.responseMetaServerId;
      const bucket = ensureServerBucket(serverBreakdown, serverId);

      responseServerDistribution[serverId] = (responseServerDistribution[serverId] || 0) + 1;
      bucket.httpResponses += 1;

      if (requestResult.responseSuccess) {
        bucket.httpSuccessResponses += 1;
      } else {
        bucket.httpFailedResponses += 1;
      }
    }
  });

  attemptLogs.forEach((attemptLog) => {
    const serverId = attemptLog?.serverId || "UNKNOWN";
    const bucket = ensureServerBucket(serverBreakdown, serverId);

    logDistribution[serverId] = (logDistribution[serverId] || 0) + 1;
    bucket.logs += 1;
  });

  orders.forEach((order) => {
    const serverId = requestIdToServerIdMap[order?.requestId] || "UNKNOWN";
    const bucket = ensureServerBucket(serverBreakdown, serverId);

    if (order?.status === ORDER_STATUSES.SUCCESS) {
      successOrdersByServerId[serverId] = (successOrdersByServerId[serverId] || 0) + 1;
      bucket.successOrders += 1;
      return;
    }

    if (order?.status === ORDER_STATUSES.FAILED) {
      failedOrdersByServerId[serverId] = (failedOrdersByServerId[serverId] || 0) + 1;
      bucket.failedOrders += 1;
    }
  });

  if (Object.keys(requestDistribution).length === 0 && requestResults.length > 0) {
    limitations.push("Request distribution by targetBaseUrl is unavailable for this data set.");
  }

  if (Object.keys(responseServerDistribution).length === 0 && Object.keys(logDistribution).length === 0) {
    limitations.push("Server ID was not available in responses or attempt logs.");
  }

  if ((successOrdersByServerId.UNKNOWN || 0) > 0 || (failedOrdersByServerId.UNKNOWN || 0) > 0) {
    limitations.push("Some orders could not be mapped back to a concrete serverId and were grouped under UNKNOWN.");
  }

  return {
    failedOrdersByServerId,
    limitations,
    logDistribution,
    requestDistribution,
    responseServerDistribution,
    serverBreakdown,
    successOrdersByServerId
  };
}

function deriveConclusion(summary, input = {}) {
  const sourceWarnings = normalizeArray(input.sourceWarnings);

  if (sourceWarnings.length > 0) {
    return {
      message: "Metrics were collected with warnings. Inspect sourceWarnings before drawing final conclusions.",
      status: "INCOMPLETE"
    };
  }

  if (summary.mode === "with-lock") {
    if (summary.businessMetrics.lockServiceUnavailableCount > 0) {
      return {
        message: "Distributed lock could not be verified because the lock service was unavailable in this run.",
        status: "LOCK_SERVICE_UNAVAILABLE"
      };
    }

    if (summary.consistencyCheck.dataConsistent === true) {
      return {
        message: summary.isMultiInstance
          ? "Redis distributed lock kept inventory consistent across multiple backend instances."
          : "Distributed lock prevented overselling and kept stock consistent.",
        status: "PASS"
      };
    }

    return {
      message: "With-lock data is inconsistent in this run. Inspect request logs, orders, and final stock before concluding success.",
      status: "FAIL"
    };
  }

  if (summary.mode === "no-lock") {
    if (
      summary.consistencyCheck.oversellDetected === true ||
      summary.consistencyCheck.negativeStockDetected === true ||
      summary.consistencyCheck.stockMismatch === true
    ) {
      return {
        message: "No-lock is unsafe under concurrent requests because the collected data shows overselling or inconsistent stock state.",
        status: "RACE_CONDITION_REPRODUCED"
      };
    }

    if (input.sourceConsistency?.sameStockReadDetected === true || input.sourceConsistency?.multipleStockCheckPassedDetected === true) {
      return {
        message:
          "No-lock race condition was not reproduced in final stock in this run, but the race window was observed. The endpoint is still unsafe by design because it reads stock before delay and updates based on stale value.",
        status: "RACE_WINDOW_OBSERVED"
      };
    }

    return {
      message:
        "No-lock race condition was not reproduced in this run. The endpoint is still unsafe by design because it reads stock before delay and updates based on stale value.",
      status: "RACE_CONDITION_NOT_REPRODUCED"
    };
  }

  if (summary.consistencyCheck.dataConsistent === true) {
    return {
      message: "Collected metrics are internally consistent.",
      status: "PASS"
    };
  }

  return {
    message: "Collected metrics are inconsistent.",
    status: "FAIL"
  };
}

function buildSummaryConfig(input = {}, mode) {
  const baseUrls = normalizeBaseUrls(input.config || {});

  return {
    baseUrls,
    concurrentRequests:
      Number.isInteger(input.config?.concurrentRequests) && input.config.concurrentRequests >= 0
        ? input.config.concurrentRequests
        : normalizeArray(input.requestResults).length,
    initialStock:
      Number.isInteger(input.config?.initialStock) && input.config.initialStock >= 0
        ? input.config.initialStock
        : isFiniteNumber(input.beforeProductSnapshot?.stock)
          ? input.beforeProductSnapshot.stock
          : null,
    productId:
      input.config?.productId ??
      input.beforeProductSnapshot?.id ??
      input.afterProductSnapshot?.id ??
      null,
    quantity:
      Number.isInteger(input.config?.quantity) && input.config.quantity > 0
        ? input.config.quantity
        : Number.isInteger(normalizeArray(input.orders)[0]?.quantity)
          ? normalizeArray(input.orders)[0].quantity
          : Number.isInteger(normalizeArray(input.requestResults)[0]?.quantity)
            ? normalizeArray(input.requestResults)[0].quantity
            : null,
    target:
      baseUrls.length > 0
        ? baseUrls
        : mode === "unknown"
          ? []
          : input.config?.baseUrl
            ? [input.config.baseUrl]
            : []
  };
}

function buildTestSummary(input = {}) {
  const mode = inferModeFromInput(input);
  const config = buildSummaryConfig(input, mode);
  const requestResults = normalizeArray(input.requestResults);
  const orders = normalizeArray(input.orders);
  const attemptLogs = normalizeArray(input.attemptLogs);
  const requestMetrics = calculateLatencyMetrics(requestResults);
  const orderMetrics = calculateOrderMetrics(orders);
  const businessMetrics = calculateBusinessMetrics({
    attemptLogs,
    orders,
    requestResults
  });
  const stockMetrics = calculateStockMetrics({
    afterProduct: input.afterProductSnapshot,
    beforeProduct: input.beforeProductSnapshot,
    initialStock: config.initialStock,
    quantity: config.quantity,
    successOrders: orderMetrics.successOrders
  });
  const consistencyCheck = calculateConsistencyCheck(
    stockMetrics.initialStock,
    stockMetrics.finalStock,
    orderMetrics.successOrders,
    config.quantity
  );
  const serverMetrics = calculateServerDistribution({
    attemptLogs,
    defaultTargetBaseUrl: config.target[0] || null,
    orders,
    requestResults
  });
  const sourceWarnings = normalizeArray(input.sourceWarnings);
  const summary = {
    businessMetrics,
    conclusion: null,
    config: {
      baseUrls: config.target,
      concurrentRequests: config.concurrentRequests,
      initialStock: stockMetrics.initialStock,
      productId: config.productId,
      quantity: config.quantity
    },
    consistencyCheck,
    isMultiInstance:
      Boolean(input.isMultiInstance) ||
      (Array.isArray(config.target) && config.target.length > 1),
    mode,
    requestMetrics,
    serverMetrics,
    sourceWarnings,
    stockMetrics,
    testName: input.testName || "UNKNOWN_TEST",
    timestamp: input.timestamp || new Date().toISOString()
  };

  summary.conclusion = deriveConclusion(summary, {
    sourceConsistency: input.sourceConsistency || input.consistencyCheck || null,
    sourceWarnings
  });

  return summary;
}

function isStandardTestSummary(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.requestMetrics &&
      value.businessMetrics &&
      value.stockMetrics &&
      value.consistencyCheck
  );
}

function buildTestSummaryFromEvidence(evidence = {}) {
  if (isStandardTestSummary(evidence)) {
    return evidence;
  }

  return buildTestSummary({
    afterProductSnapshot: evidence.afterProductSnapshot || null,
    attemptLogs: evidence.attemptLogs || [],
    beforeProductSnapshot: evidence.beforeProductSnapshot || evidence.preResetProductSnapshot || null,
    config: evidence.config || {},
    consistencyCheck: evidence.consistencyCheck || null,
    isMultiInstance: Boolean(evidence.isMultiInstance) || Boolean(evidence.mode && Array.isArray(evidence.baseUrls)),
    mode: evidence.mode,
    orders: evidence.orders || [],
    requestResults: evidence.requestResults || [],
    sourceWarnings: evidence.summary?.fetchWarnings || evidence.fetchWarnings || [],
    testName: evidence.testName || "UNKNOWN_TEST",
    timestamp: evidence.timestamp || new Date().toISOString()
  });
}

module.exports = {
  aggregateCounts,
  buildTestSummary,
  buildTestSummaryFromEvidence,
  calculateBusinessMetrics,
  calculateConsistencyCheck,
  calculateLatencyMetrics,
  calculateOrderMetrics,
  calculateServerDistribution,
  calculateStockMetrics,
  isStandardTestSummary,
  percentile
};
