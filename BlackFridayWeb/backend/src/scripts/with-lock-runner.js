const { performance } = require("node:perf_hooks");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../constants/domain");
  const {
    aggregateCounts,
    authenticateAdmin,
    buildAuthorizationHeaders,
    extractSettledApiData,
  formatBooleanForOutput,
  padNumber,
  parseArguments,
  parseBoolean,
  parseOptionalString,
  parsePositiveInteger,
  printSection,
  requestJson,
  toRoundedMs,
  unwrapApiSuccess
} = require("./script-helpers");

const DEFAULT_CONFIG = Object.freeze({
  baseUrl: "http://127.0.0.1:4000",
  concurrentRequests: 20,
  initialStock: 1,
  adminEmail: "admin@example.com",
  adminPassword: "password",
  quantity: 1,
  reportDir: "reports",
  reportEnabled: true,
  requestPrefix: "with-lock-test",
  timeoutMs: 10000,
  userPrefix: "with-lock-user"
});

const IMPORTANT_ATTEMPT_ACTIONS = Object.freeze([
  PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_STARTED,
  PURCHASE_LOG_ACTIONS.LOCK_ACQUIRED_FOR_PURCHASE,
  PURCHASE_LOG_ACTIONS.DUPLICATE_REQUEST_DETECTED,
  PURCHASE_LOG_ACTIONS.PRODUCT_READ_WITH_LOCK,
  PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED_WITH_LOCK,
  PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED_WITH_LOCK,
  PURCHASE_LOG_ACTIONS.STOCK_UPDATED_WITH_LOCK,
  PURCHASE_LOG_ACTIONS.ORDER_CREATED_WITH_LOCK,
  PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE,
  PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_SUCCESS,
  PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED
]);

function parseScriptConfig(argv = process.argv.slice(2), env = process.env, overrides = {}) {
  const argumentsMap = parseArguments(argv);
  const defaults = {
    ...DEFAULT_CONFIG,
    ...overrides
  };
  const baseUrl = argumentsMap.baseUrl || env.BASE_URL || defaults.baseUrl;
  const productId = argumentsMap.productId || env.PRODUCT_ID || defaults.productId;

  try {
    return {
      ...defaults,
      adminEmail: argumentsMap.adminEmail || env.ADMIN_EMAIL || env.AUTH_EMAIL || defaults.adminEmail,
      adminPassword: argumentsMap.adminPassword || env.ADMIN_PASSWORD || env.AUTH_PASSWORD || defaults.adminPassword,
      baseUrl: new URL(baseUrl).toString(),
      concurrentRequests: parsePositiveInteger(
        argumentsMap.requests || argumentsMap.concurrentRequests || env.CONCURRENT_REQUESTS || defaults.concurrentRequests,
        "concurrentRequests"
      ),
      initialStock: parsePositiveInteger(
        argumentsMap.stock || argumentsMap.initialStock || env.INITIAL_STOCK || defaults.initialStock,
        "initialStock",
        { min: 0 }
      ),
      productId: parsePositiveInteger(productId, "productId", { allowUndefined: true }),
      quantity: parsePositiveInteger(argumentsMap.quantity || env.QUANTITY || defaults.quantity, "quantity"),
      reportDir: parseOptionalString(argumentsMap.reportDir || env.REPORT_DIR, "reportDir", defaults.reportDir),
      reportEnabled: parseBoolean(
        argumentsMap.reportEnabled || argumentsMap.saveReport || env.REPORT_ENABLED || env.SAVE_REPORT,
        "reportEnabled",
        defaults.reportEnabled
      ),
      requestPrefix: parseOptionalString(
        argumentsMap.requestPrefix || env.REQUEST_PREFIX,
        "requestPrefix",
        defaults.requestPrefix
      ),
      timeoutMs: parsePositiveInteger(argumentsMap.timeoutMs || env.REQUEST_TIMEOUT_MS || defaults.timeoutMs, "timeoutMs"),
      userPrefix: parseOptionalString(argumentsMap.userPrefix || env.USER_PREFIX, "userPrefix", defaults.userPrefix)
    };
  } catch (error) {
    throw new Error(`Invalid script configuration: ${error.message}`);
  }
}

function normalizeErrorCode(requestResult) {
  if (requestResult.errorCode) {
    return requestResult.errorCode;
  }

  if (requestResult.responseSuccess) {
    return "SUCCESS";
  }

  return "UNKNOWN_ERROR";
}

async function ensureBackendIsReady(config) {
  const response = await requestJson(config.baseUrl, "GET", "/health", {
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess("GET /health", response);
}

async function fetchProductById(config, adminToken, productId) {
  const response = await requestJson(config.baseUrl, "GET", `/api/admin/products/${productId}`, {
    headers: buildAuthorizationHeaders(adminToken),
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess(`GET /api/admin/products/${productId}`, response);
}

async function resolveTargetProduct(config, adminToken) {
  if (config.productId) {
    return fetchProductById(config, adminToken, config.productId);
  }

  const response = await requestJson(config.baseUrl, "GET", "/api/admin/products", {
    headers: buildAuthorizationHeaders(adminToken),
    timeoutMs: config.timeoutMs
  });
  const products = unwrapApiSuccess("GET /api/admin/products", response);

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("No products found. Create or seed at least one product before running the with-lock test.");
  }

  return [...products].sort((leftProduct, rightProduct) => {
    if (leftProduct.stock !== rightProduct.stock) {
      return leftProduct.stock - rightProduct.stock;
    }

    return leftProduct.id - rightProduct.id;
  })[0];
}

async function resetProductForTest(config, adminToken, productId) {
  const response = await requestJson(config.baseUrl, "POST", `/api/admin/products/${productId}/reset`, {
    body: {
      clearLogs: true,
      clearOrders: true,
      stock: config.initialStock
    },
    headers: buildAuthorizationHeaders(adminToken, {
      "x-request-id": `${config.requestPrefix}-reset`
    }),
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess(`POST /api/admin/products/${productId}/reset`, response);
}

function buildPurchasePayload(config, productId, requestIndex) {
  const suffix = padNumber(requestIndex + 1);

  return {
    productId,
    quantity: config.quantity,
    requestId: `${config.requestPrefix}-${suffix}`,
    userId: `${config.userPrefix}-${suffix}`
  };
}

async function executePurchaseRequest(config, productId, requestIndex) {
  const payload = buildPurchasePayload(config, productId, requestIndex);
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();

  try {
    const response = await requestJson(config.baseUrl, "POST", "/api/purchase/with-lock", {
      body: payload,
      headers: {
        "x-request-id": payload.requestId
      },
      timeoutMs: config.timeoutMs
    });
    const endedAt = new Date().toISOString();

    return {
      durationMs: toRoundedMs(performance.now() - startedAtMs),
      endedAt,
      errorCode: response.body?.error?.code || null,
      errorMessage: response.ok ? null : response.body?.message || response.rawBody || null,
      httpStatus: response.statusCode,
      productId,
      quantity: config.quantity,
      requestId: payload.requestId,
      responseBody: response.body,
      responseSuccess: Boolean(response.ok && response.body?.success === true),
      startedAt,
      transportError: null,
      userId: payload.userId
    };
  } catch (error) {
    const endedAt = new Date().toISOString();

    return {
      durationMs: toRoundedMs(performance.now() - startedAtMs),
      endedAt,
      errorCode: "NETWORK_ERROR",
      errorMessage: error.message,
      httpStatus: null,
      productId,
      quantity: config.quantity,
      requestId: payload.requestId,
      responseBody: null,
      responseSuccess: false,
      startedAt,
      transportError: error.message,
      userId: payload.userId
    };
  }
}

async function fetchPostTestData(config, adminToken, productId) {
  const fetchTasks = await Promise.allSettled([
    requestJson(config.baseUrl, "GET", `/api/admin/products/${productId}`, {
      headers: buildAuthorizationHeaders(adminToken),
      timeoutMs: config.timeoutMs
    }),
    requestJson(config.baseUrl, "GET", "/api/admin/orders", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(config.baseUrl, "GET", "/api/admin/attempt-logs", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(config.baseUrl, "GET", "/api/admin/stats", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    })
  ]);

  return {
    afterProductSnapshot: extractSettledApiData(fetchTasks[0], `GET /api/admin/products/${productId}`),
    attemptLogs: extractSettledApiData(fetchTasks[2], `GET /api/admin/attempt-logs?productId=${productId}`),
    orders: extractSettledApiData(fetchTasks[1], `GET /api/admin/orders?productId=${productId}`),
    stats: extractSettledApiData(fetchTasks[3], `GET /api/admin/stats?productId=${productId}`)
  };
}

function buildRequestSummary(requestResults) {
  const durations = requestResults.map((requestResult) => requestResult.durationMs);
  const httpSuccessResponses = requestResults.filter((requestResult) => requestResult.responseSuccess).length;
  const httpFailedResponses = requestResults.length - httpSuccessResponses;
  const networkFailures = requestResults.filter((requestResult) => requestResult.transportError).length;
  const errorCodeCounts = aggregateCounts(requestResults.map(normalizeErrorCode));

  return {
    averageDurationMs:
      requestResults.length > 0 ? toRoundedMs(durations.reduce((total, value) => total + value, 0) / requestResults.length) : 0,
    failedRequestIds: requestResults.filter((requestResult) => !requestResult.responseSuccess).map((requestResult) => requestResult.requestId),
    httpFailedResponses,
    httpSuccessResponses,
    lockTimeoutResponses: errorCodeCounts.LOCK_TIMEOUT || 0,
    maxDurationMs: requestResults.length > 0 ? Math.max(...durations) : 0,
    minDurationMs: requestResults.length > 0 ? Math.min(...durations) : 0,
    networkFailures,
    outOfStockResponses: errorCodeCounts.OUT_OF_STOCK || 0,
    productNotFoundResponses: errorCodeCounts.PRODUCT_NOT_FOUND || 0,
    resultCountsByErrorCode: errorCodeCounts,
    resultCountsByHttpStatus: aggregateCounts(
      requestResults.map((requestResult) => String(requestResult.httpStatus ?? "NO_RESPONSE"))
    ),
    successfulRequestIds: requestResults.filter((requestResult) => requestResult.responseSuccess).map((requestResult) => requestResult.requestId),
    totalRequests: requestResults.length
  };
}

function buildOrderSummary(orders = []) {
  const ordersByStatus = aggregateCounts(orders.map((order) => order.status));
  const successOrders = orders.filter((order) => order.status === ORDER_STATUSES.SUCCESS);
  const failedOrders = orders.filter((order) => order.status === ORDER_STATUSES.FAILED);

  return {
    failedOrderIds: failedOrders.map((order) => order.id),
    failedOrderRequestIds: failedOrders.map((order) => order.requestId),
    failedOrders: failedOrders.length,
    ordersByStatus,
    requestIdsCreatedSuccessfully: successOrders.map((order) => order.requestId),
    successOrderIds: successOrders.map((order) => order.id),
    successOrders: successOrders.length,
    totalOrders: orders.length
  };
}

function buildAttemptLogSummary(requestResults, attemptLogs = []) {
  const requestIdSet = new Set(requestResults.map((requestResult) => requestResult.requestId));
  const relevantLogs = attemptLogs.filter((attemptLog) => requestIdSet.has(attemptLog.requestId));
  const importantLogs = relevantLogs.filter((attemptLog) => IMPORTANT_ATTEMPT_ACTIONS.includes(attemptLog.action));
  const logsByRequestId = relevantLogs.reduce((accumulator, attemptLog) => {
    accumulator[attemptLog.requestId] = accumulator[attemptLog.requestId] || [];
    accumulator[attemptLog.requestId].push(attemptLog);
    return accumulator;
  }, {});

  return {
    importantActionCounts: aggregateCounts(importantLogs.map((attemptLog) => attemptLog.action)),
    importantLogs,
    logsByRequestId,
    totalAttemptLogs: relevantLogs.length
  };
}

function buildConsistencyCheck(config, afterProductSnapshot, orderSummary, attemptLogSummary) {
  const actualFinalStock = afterProductSnapshot?.stock ?? null;
  const maxSuccessOrdersByQuantity = config.quantity > 0 ? Math.floor(config.initialStock / config.quantity) : 0;
  const expectedFinalStock = config.initialStock - orderSummary.successOrders * config.quantity;
  const oversellDetected = orderSummary.successOrders > maxSuccessOrdersByQuantity;
  const negativeStockDetected = typeof actualFinalStock === "number" ? actualFinalStock < 0 : null;
  const stockMismatch = typeof actualFinalStock === "number" ? actualFinalStock !== expectedFinalStock : null;

  const successRequestIdSet = new Set(orderSummary.requestIdsCreatedSuccessfully);
  const successLogs = attemptLogSummary.importantLogs.filter((attemptLog) => successRequestIdSet.has(attemptLog.requestId));
  const successLockAcquiredRequestIds = new Set(
    successLogs
      .filter((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.LOCK_ACQUIRED_FOR_PURCHASE)
      .map((attemptLog) => attemptLog.requestId)
  );
  const successFlowCompletedRequestIds = new Set(
    successLogs
      .filter((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_SUCCESS)
      .map((attemptLog) => attemptLog.requestId)
  );
  const successReadLogEntries = successLogs.filter(
    (attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PRODUCT_READ_WITH_LOCK && attemptLog.stockBefore !== null
  );
  const successRequestIdsMissingLockAcquired = orderSummary.requestIdsCreatedSuccessfully.filter(
    (requestId) => !successLockAcquiredRequestIds.has(requestId)
  );
  const successRequestIdsMissingCompletion = orderSummary.requestIdsCreatedSuccessfully.filter(
    (requestId) => !successFlowCompletedRequestIds.has(requestId)
  );
  const successReadAtInitialStockRequestIds = [
    ...new Set(
      successReadLogEntries
        .filter((attemptLog) => attemptLog.stockBefore === config.initialStock)
        .map((attemptLog) => attemptLog.requestId)
    )
  ];
  const multipleSuccessReadAtInitialStockDetected = successReadAtInitialStockRequestIds.length > 1;

  const lockEffectivenessPass =
    oversellDetected !== true &&
    negativeStockDetected !== true &&
    stockMismatch !== true &&
    successRequestIdsMissingLockAcquired.length === 0 &&
    successRequestIdsMissingCompletion.length === 0 &&
    multipleSuccessReadAtInitialStockDetected !== true;

  const dataConsistent =
    typeof actualFinalStock === "number" ? oversellDetected !== true && negativeStockDetected !== true && stockMismatch !== true : null;

  return {
    actualFinalStock,
    dataConsistent,
    expectedFinalStock,
    lockEffectivenessPass,
    maxSuccessOrdersByQuantity,
    multipleSuccessReadAtInitialStockDetected,
    negativeStockDetected,
    oversellDetected,
    stockMismatch,
    successReadAtInitialStockRequestIds,
    successRequestIdsMissingCompletion,
    successRequestIdsMissingLockAcquired
  };
}

function buildConclusion(consistencyCheck, warnings = []) {
  if (warnings.length > 0) {
    return {
      message: "With-lock evidence collected with warnings. Some post-test data could not be fetched.",
      status: "INCOMPLETE"
    };
  }

  if (consistencyCheck.lockEffectivenessPass) {
    return {
      message: "Distributed lock prevented overselling under concurrent requests.",
      status: "PASS"
    };
  }

  return {
    message: "With-lock flow failed consistency check. Please inspect logs.",
    status: "FAIL"
  };
}

function buildEnvironmentInfo(config, healthData) {
  return {
    appEnvironment: healthData.environment,
    appName: healthData.appName,
    baseUrl: config.baseUrl,
    cwd: process.cwd(),
    database: healthData.services?.database ?? null,
    nodeVersion: process.version,
    platform: process.platform,
    server: healthData.server ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

function printRequestResults(requestResults) {
  printSection("Per-Request Result Table");

  console.table(
    requestResults.map((requestResult) => ({
      durationMs: requestResult.durationMs,
      errorCode: requestResult.errorCode || "",
      httpStatus: requestResult.httpStatus ?? "NO_RESPONSE",
      requestId: requestResult.requestId,
      success: requestResult.responseSuccess ? "YES" : "NO"
    }))
  );
}

function printEvidenceSummary(evidence, title) {
  printSection(title);
  console.log(`Base URL: ${evidence.config.baseUrl}`);
  console.log(`Product ID: ${evidence.beforeProductSnapshot.id} (${evidence.beforeProductSnapshot.code})`);
  console.log(`Initial Stock: ${evidence.config.initialStock}`);
  console.log(`Concurrent Requests: ${evidence.config.concurrentRequests}`);
  console.log(`Quantity Per Request: ${evidence.config.quantity}`);
  console.log("Endpoint: /api/purchase/with-lock");

  printSection("Request Summary");
  console.log(`- Total Requests: ${evidence.summary.requestSummary.totalRequests}`);
  console.log(`- HTTP Success Responses: ${evidence.summary.requestSummary.httpSuccessResponses}`);
  console.log(`- HTTP Failed Responses: ${evidence.summary.requestSummary.httpFailedResponses}`);
  console.log(`- Lock Timeout Responses: ${evidence.summary.requestSummary.lockTimeoutResponses}`);
  console.log(`- Out Of Stock Responses: ${evidence.summary.requestSummary.outOfStockResponses}`);
  console.log(`- Product Not Found Responses: ${evidence.summary.requestSummary.productNotFoundResponses}`);

  printSection("Order Summary");
  console.log(`- Total Orders: ${evidence.summary.orderSummary.totalOrders}`);
  console.log(`- SUCCESS Orders: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- FAILED Orders: ${evidence.summary.orderSummary.failedOrders}`);

  printSection("Stock Summary");
  console.log(`- Initial Stock: ${evidence.config.initialStock}`);
  console.log(`- Final Stock: ${evidence.afterProductSnapshot?.stock ?? "UNKNOWN"}`);
  console.log(`- Expected Final Stock: ${evidence.consistencyCheck.expectedFinalStock}`);

  printSection("Consistency Check");
  console.log(`- Expected Max Success Orders: ${evidence.consistencyCheck.maxSuccessOrdersByQuantity}`);
  console.log(`- Actual Success Orders: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- Oversell Detected: ${formatBooleanForOutput(evidence.consistencyCheck.oversellDetected)}`);
  console.log(`- Negative Stock Detected: ${formatBooleanForOutput(evidence.consistencyCheck.negativeStockDetected)}`);
  console.log(`- Stock Mismatch: ${formatBooleanForOutput(evidence.consistencyCheck.stockMismatch)}`);
  console.log(`- Data Consistent: ${formatBooleanForOutput(evidence.consistencyCheck.dataConsistent)}`);
  console.log(`- Lock Effectiveness: ${evidence.consistencyCheck.lockEffectivenessPass ? "PASS" : "FAIL"}`);

  if (Object.keys(evidence.summary.requestSummary.resultCountsByHttpStatus).length > 0) {
    printSection("HTTP Status Distribution");
    Object.entries(evidence.summary.requestSummary.resultCountsByHttpStatus).forEach(([statusCode, count]) => {
      console.log(`- ${statusCode}: ${count}`);
    });
  }

  if (Object.keys(evidence.summary.requestSummary.resultCountsByErrorCode).length > 0) {
    printSection("Error Code Distribution");
    Object.entries(evidence.summary.requestSummary.resultCountsByErrorCode).forEach(([errorCode, count]) => {
      console.log(`- ${errorCode}: ${count}`);
    });
  }

  if (evidence.summary.fetchWarnings.length > 0) {
    printSection("Warnings");
    evidence.summary.fetchWarnings.forEach((warning) => {
      console.log(`- ${warning}`);
    });
  }

  printSection("Conclusion");
  console.log(`- Status: ${evidence.conclusion.status}`);
  console.log(`- ${evidence.conclusion.message}`);
}

async function runWithLockScenario(config, options = {}) {
  const { scenarioTitle = "WITH-LOCK CONCURRENCY TEST", printProgress = true } = options;

  if (printProgress) {
    printSection(scenarioTitle);
  }

  const startedAt = new Date().toISOString();
  const healthData = await ensureBackendIsReady(config);
  const adminSession = await authenticateAdmin(config.baseUrl, config);
  const preResetProductSnapshot = await resolveTargetProduct(config, adminSession.token);

  if (printProgress) {
    console.log(
      `Selected product: ${preResetProductSnapshot.id} (${preResetProductSnapshot.code}) - current stock ${preResetProductSnapshot.stock}`
    );
  }

  const resetResult = await resetProductForTest(config, adminSession.token, preResetProductSnapshot.id);
  const beforeProductSnapshot = await fetchProductById(config, adminSession.token, preResetProductSnapshot.id);

  if (printProgress) {
    console.log(
      `Reset completed: stock=${resetResult.product.stock}, deletedOrders=${resetResult.deletedOrders}, deletedAttemptLogs=${resetResult.deletedAttemptLogs}`
    );
  }

  const batchStartedAtMs = performance.now();
  const requestResults = await Promise.all(
    Array.from({ length: config.concurrentRequests }, (_, requestIndex) =>
      executePurchaseRequest(config, preResetProductSnapshot.id, requestIndex)
    )
  );
  const totalBatchDurationMs = toRoundedMs(performance.now() - batchStartedAtMs);

  const postTestData = await fetchPostTestData(config, adminSession.token, preResetProductSnapshot.id);
  const afterProductSnapshot = postTestData.afterProductSnapshot.available ? postTestData.afterProductSnapshot.data : null;
  const orders = postTestData.orders.available ? postTestData.orders.data : [];
  const attemptLogs = postTestData.attemptLogs.available ? postTestData.attemptLogs.data : [];
  const statsSnapshot = postTestData.stats.available ? postTestData.stats.data : null;

  const requestSummary = buildRequestSummary(requestResults);
  const orderSummary = buildOrderSummary(orders);
  const attemptLogSummary = buildAttemptLogSummary(requestResults, attemptLogs);
  const consistencyCheck = buildConsistencyCheck(config, afterProductSnapshot, orderSummary, attemptLogSummary);
  const fetchWarnings = [
    !postTestData.afterProductSnapshot.available
      ? `Could not fetch product snapshot after test: ${postTestData.afterProductSnapshot.errorMessage}`
      : null,
    !postTestData.orders.available ? `Could not fetch orders after test: ${postTestData.orders.errorMessage}` : null,
    !postTestData.attemptLogs.available ? `Could not fetch attempt logs after test: ${postTestData.attemptLogs.errorMessage}` : null,
    !postTestData.stats.available ? `Could not fetch stats after test: ${postTestData.stats.errorMessage}` : null
  ].filter(Boolean);
  const conclusion = buildConclusion(consistencyCheck, fetchWarnings);

  return {
    afterProductSnapshot,
    attemptLogs,
    beforeProductSnapshot,
    conclusion,
    config,
    consistencyCheck,
    environmentInfo: buildEnvironmentInfo(config, healthData),
    orders,
    preResetProductSnapshot,
    requestResults,
    summary: {
      attemptLogSummary,
      fetchWarnings,
      orderSummary,
      requestSummary: {
        ...requestSummary,
        totalBatchDurationMs
      },
      statsSnapshot
    },
    testName: "WITH_LOCK_CONCURRENCY_TEST",
    timestamp: new Date().toISOString(),
    startedAt
  };
}

module.exports = {
  DEFAULT_CONFIG,
  IMPORTANT_ATTEMPT_ACTIONS,
  parseScriptConfig,
  printEvidenceSummary,
  printRequestResults,
  runWithLockScenario
};
