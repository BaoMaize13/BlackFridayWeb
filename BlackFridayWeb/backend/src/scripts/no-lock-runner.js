const { performance } = require("node:perf_hooks");

const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS } = require("../constants/domain");

const DEFAULT_CONFIG = Object.freeze({
  baseUrl: "http://127.0.0.1:4000",
  concurrentRequests: 20,
  initialStock: 1,
  quantity: 1,
  requestPrefix: "no-lock-test",
  saveReport: true,
  timeoutMs: 10000,
  userPrefix: "user"
});

const IMPORTANT_ATTEMPT_ACTIONS = Object.freeze([
  PURCHASE_LOG_ACTIONS.PRODUCT_READ,
  PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED,
  PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_STARTED,
  PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_ENDED,
  PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
  PURCHASE_LOG_ACTIONS.ORDER_CREATED,
  PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS,
  PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED
]);

function parseArguments(argv) {
  const parsedArgs = {};

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const normalizedArgument = argument.slice(2);
    const separatorIndex = normalizedArgument.indexOf("=");

    if (separatorIndex === -1) {
      parsedArgs[normalizedArgument] = "true";
      continue;
    }

    const key = normalizedArgument.slice(0, separatorIndex);
    const value = normalizedArgument.slice(separatorIndex + 1);
    parsedArgs[key] = value;
  }

  return parsedArgs;
}

function parsePositiveInteger(value, fieldName, options = {}) {
  const { allowUndefined = false, min = 1 } = options;

  if (value === undefined || value === null || value === "") {
    if (allowUndefined) {
      return undefined;
    }

    throw new Error(`${fieldName} is required and must be an integer greater than or equal to ${min}`);
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min) {
    throw new Error(`${fieldName} must be an integer greater than or equal to ${min}`);
  }

  return parsedValue;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error("saveReport must be either true or false");
}

function buildNoLockScriptConfig(argv = process.argv.slice(2), env = process.env, overrides = {}) {
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
      requestPrefix: argumentsMap.requestPrefix || env.REQUEST_PREFIX || defaults.requestPrefix,
      saveReport: parseBoolean(argumentsMap.saveReport || env.SAVE_REPORT, defaults.saveReport),
      timeoutMs: parsePositiveInteger(argumentsMap.timeoutMs || env.REQUEST_TIMEOUT_MS || defaults.timeoutMs, "timeoutMs"),
      userPrefix: argumentsMap.userPrefix || env.USER_PREFIX || defaults.userPrefix
    };
  } catch (error) {
    throw new Error(`Invalid script configuration: ${error.message}`);
  }
}

function buildUrl(baseUrl, pathname, query = {}) {
  const url = new URL(pathname, baseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function requestJson(baseUrl, method, pathname, options = {}) {
  const { body, headers = {}, query, timeoutMs = DEFAULT_CONFIG.timeoutMs } = options;
  const url = buildUrl(baseUrl, pathname, query);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      method,
      signal: abortController.signal
    });

    const rawBody = await response.text();
    let parsedBody = null;

    if (rawBody.trim()) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (error) {
        parsedBody = null;
      }
    }

    return {
      body: parsedBody,
      ok: response.ok,
      rawBody,
      statusCode: response.status,
      url: url.toString()
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request to ${url.toString()} timed out after ${timeoutMs}ms`);
    }

    throw new Error(`Request to ${url.toString()} failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function describeApiFailure(label, response) {
  const errorCode = response.body?.error?.code ? ` [${response.body.error.code}]` : "";
  const message = response.body?.message || response.rawBody || "Unexpected API response";
  return `${label} failed with status ${response.statusCode}${errorCode}: ${message}`;
}

function unwrapApiSuccess(label, response) {
  if (!response.ok) {
    throw new Error(describeApiFailure(label, response));
  }

  if (!response.body || typeof response.body !== "object" || response.body.success !== true) {
    throw new Error(`${label} returned an invalid JSON envelope`);
  }

  return response.body.data;
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function formatBooleanForOutput(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  return value ? "YES" : "NO";
}

function toRoundedMs(value) {
  return Number(value.toFixed(2));
}

function padNumber(value) {
  return String(value).padStart(3, "0");
}

async function ensureBackendIsReady(config) {
  const response = await requestJson(config.baseUrl, "GET", "/health", {
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess("GET /health", response);
}

async function fetchProductById(config, productId) {
  const response = await requestJson(config.baseUrl, "GET", `/admin/products/${productId}`, {
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess(`GET /admin/products/${productId}`, response);
}

async function resolveTargetProduct(config) {
  if (config.productId) {
    return fetchProductById(config, config.productId);
  }

  const response = await requestJson(config.baseUrl, "GET", "/admin/products", {
    timeoutMs: config.timeoutMs
  });
  const products = unwrapApiSuccess("GET /admin/products", response);

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("No products found. Create or seed at least one product before running the no-lock test.");
  }

  return [...products].sort((leftProduct, rightProduct) => {
    if (leftProduct.stock !== rightProduct.stock) {
      return leftProduct.stock - rightProduct.stock;
    }

    return leftProduct.id - rightProduct.id;
  })[0];
}

async function resetProductForTest(config, productId) {
  const response = await requestJson(config.baseUrl, "POST", `/admin/products/${productId}/reset`, {
    body: {
      clearLogs: true,
      clearOrders: true,
      stock: config.initialStock
    },
    headers: {
      "x-request-id": `${config.requestPrefix}-reset`
    },
    timeoutMs: config.timeoutMs
  });

  return unwrapApiSuccess(`POST /admin/products/${productId}/reset`, response);
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
    const response = await requestJson(config.baseUrl, "POST", "/purchase/no-lock", {
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

function extractSettledApiData(settledResult, label) {
  if (settledResult.status === "rejected") {
    return {
      available: false,
      errorMessage: settledResult.reason.message
    };
  }

  try {
    return {
      available: true,
      data: unwrapApiSuccess(label, settledResult.value)
    };
  } catch (error) {
    return {
      available: false,
      errorMessage: error.message
    };
  }
}

async function fetchPostTestData(config, productId) {
  const fetchTasks = await Promise.allSettled([
    requestJson(config.baseUrl, "GET", `/admin/products/${productId}`, { timeoutMs: config.timeoutMs }),
    requestJson(config.baseUrl, "GET", "/admin/orders", {
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(config.baseUrl, "GET", "/admin/attempt-logs", {
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(config.baseUrl, "GET", "/admin/stats", {
      query: { productId },
      timeoutMs: config.timeoutMs
    })
  ]);

  return {
    afterProductSnapshot: extractSettledApiData(fetchTasks[0], `GET /admin/products/${productId}`),
    attemptLogs: extractSettledApiData(fetchTasks[2], `GET /admin/attempt-logs?productId=${productId}`),
    orders: extractSettledApiData(fetchTasks[1], `GET /admin/orders?productId=${productId}`),
    stats: extractSettledApiData(fetchTasks[3], `GET /admin/stats?productId=${productId}`)
  };
}

function aggregateCounts(values) {
  return values.reduce((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

function buildRequestSummary(requestResults) {
  const durations = requestResults.map((requestResult) => requestResult.durationMs);
  const httpSuccessResponses = requestResults.filter((requestResult) => requestResult.responseSuccess).length;
  const httpFailedResponses = requestResults.length - httpSuccessResponses;
  const networkFailures = requestResults.filter((requestResult) => requestResult.transportError).length;

  return {
    averageDurationMs: requestResults.length > 0 ? toRoundedMs(durations.reduce((total, value) => total + value, 0) / requestResults.length) : 0,
    failedRequestIds: requestResults.filter((requestResult) => !requestResult.responseSuccess).map((requestResult) => requestResult.requestId),
    httpFailedResponses,
    httpSuccessResponses,
    maxDurationMs: requestResults.length > 0 ? Math.max(...durations) : 0,
    minDurationMs: requestResults.length > 0 ? Math.min(...durations) : 0,
    networkFailures,
    resultCountsByErrorCode: aggregateCounts(
      requestResults
        .filter((requestResult) => requestResult.errorCode)
        .map((requestResult) => requestResult.errorCode)
    ),
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

function buildConsistencyCheck(config, beforeProductSnapshot, afterProductSnapshot, orderSummary, attemptLogSummary) {
  const actualFinalStock = afterProductSnapshot?.stock ?? null;
  const expectedFinalStock = config.initialStock - orderSummary.successOrders * config.quantity;
  const expectedMaxSuccessOrders = config.quantity > 0 ? Math.floor(config.initialStock / config.quantity) : 0;
  const oversellDetected = orderSummary.successOrders > expectedMaxSuccessOrders;
  const negativeStockDetected = typeof actualFinalStock === "number" ? actualFinalStock < 0 : null;
  const stockMismatch = typeof actualFinalStock === "number" ? actualFinalStock !== expectedFinalStock : null;

  const productReadLogs = attemptLogSummary.importantLogs.filter(
    (attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.PRODUCT_READ && attemptLog.stockBefore !== null
  );
  const sameStockReadGroupsMap = productReadLogs.reduce((accumulator, attemptLog) => {
    const stockKey = String(attemptLog.stockBefore);
    accumulator[stockKey] = accumulator[stockKey] || new Set();
    accumulator[stockKey].add(attemptLog.requestId);
    return accumulator;
  }, {});

  const sameStockReadGroups = Object.entries(sameStockReadGroupsMap)
    .map(([stockBefore, requestIds]) => ({
      requestIds: [...requestIds],
      stockBefore: Number(stockBefore)
    }))
    .filter((group) => group.requestIds.length >= 2);

  const sameStockReadDetected = sameStockReadGroups.length > 0;
  const stockCheckPassedRequestIds = [
    ...new Set(
      attemptLogSummary.importantLogs
        .filter((attemptLog) => attemptLog.action === PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED)
        .map((attemptLog) => attemptLog.requestId)
    )
  ];
  const multipleStockCheckPassedDetected = stockCheckPassedRequestIds.length > expectedMaxSuccessOrders;
  const dataConsistent =
    typeof actualFinalStock === "number"
      ? oversellDetected !== true && negativeStockDetected !== true && stockMismatch !== true
      : null;

  return {
    actualFinalStock,
    dataConsistent,
    expectedFinalStock,
    expectedMaxSuccessOrders,
    multipleStockCheckPassedDetected,
    negativeStockDetected,
    oversellDetected,
    sameStockReadDetected,
    sameStockReadGroups,
    stockCheckPassedRequestIds,
    stockMismatch
  };
}

function buildConclusion(consistencyCheck, warnings = []) {
  const hasHardEvidence =
    consistencyCheck.oversellDetected === true ||
    consistencyCheck.negativeStockDetected === true ||
    consistencyCheck.stockMismatch === true;

  if (warnings.length > 0) {
    return {
      message: "Evidence collection completed with warnings. Some post-test data could not be fetched.",
      reproduced: hasHardEvidence,
      status: "INCOMPLETE"
    };
  }

  if (hasHardEvidence) {
    return {
      message: "The no-lock purchase flow is not safe under concurrent requests. The collected evidence shows overselling or inconsistent stock state.",
      reproduced: true,
      status: "RACE_CONDITION_REPRODUCED"
    };
  }

  if (consistencyCheck.sameStockReadDetected || consistencyCheck.multipleStockCheckPassedDetected) {
    return {
      message:
        "The race window was observed because multiple requests read the same stock snapshot or passed the stock check concurrently, but inconsistent final data was not reproduced in this run.",
      reproduced: false,
      status: "RACE_WINDOW_OBSERVED"
    };
  }

  return {
    message:
      "Race condition was not reproduced in this run. Increase CONCURRENT_REQUESTS or NO_LOCK_PURCHASE_DELAY_MS and run the evidence script again.",
    reproduced: false,
    status: "RACE_CONDITION_NOT_REPRODUCED"
  };
}

function buildEnvironmentInfo(config, healthData) {
  return {
    appName: healthData.appName,
    appEnvironment: healthData.environment,
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
  console.log(`Initial Stock: ${evidence.beforeProductSnapshot.stock}`);
  console.log(`Concurrent Requests: ${evidence.config.concurrentRequests}`);
  console.log(`Quantity Per Request: ${evidence.config.quantity}`);
  console.log(`Total Batch Duration: ${evidence.summary.requestSummary.totalBatchDurationMs}ms`);

  printSection("Request Summary");
  console.log(`- Total Requests: ${evidence.summary.requestSummary.totalRequests}`);
  console.log(`- HTTP Success Responses: ${evidence.summary.requestSummary.httpSuccessResponses}`);
  console.log(`- HTTP Failed Responses: ${evidence.summary.requestSummary.httpFailedResponses}`);
  console.log(`- Order SUCCESS Count: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- Order FAILED Count: ${evidence.summary.orderSummary.failedOrders}`);
  console.log(`- Final Stock: ${evidence.afterProductSnapshot?.stock ?? "UNKNOWN"}`);
  console.log(`- Attempt Logs Count: ${evidence.summary.attemptLogSummary.totalAttemptLogs}`);

  printSection("Consistency Check");
  console.log(`- Expected Max Success Orders: ${evidence.consistencyCheck.expectedMaxSuccessOrders}`);
  console.log(`- Actual Success Orders: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- Expected Final Stock: ${evidence.consistencyCheck.expectedFinalStock}`);
  console.log(`- Oversell Detected: ${formatBooleanForOutput(evidence.consistencyCheck.oversellDetected)}`);
  console.log(`- Negative Stock Detected: ${formatBooleanForOutput(evidence.consistencyCheck.negativeStockDetected)}`);
  console.log(`- Stock Mismatch: ${formatBooleanForOutput(evidence.consistencyCheck.stockMismatch)}`);
  console.log(`- Same Stock Read Detected: ${formatBooleanForOutput(evidence.consistencyCheck.sameStockReadDetected)}`);
  console.log(`- Data Consistent: ${formatBooleanForOutput(evidence.consistencyCheck.dataConsistent)}`);

  printSection("Race Evidence");
  if (evidence.consistencyCheck.sameStockReadGroups.length > 0) {
    evidence.consistencyCheck.sameStockReadGroups.forEach((group) => {
      console.log(`- stockBefore=${group.stockBefore}: ${group.requestIds.join(", ")}`);
    });
  } else {
    console.log("- No repeated PRODUCT_READ stock snapshot was detected.");
  }

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

async function runNoLockScenario(config, options = {}) {
  const { scenarioTitle = "NO-LOCK CONCURRENCY TEST", printProgress = true } = options;

  if (printProgress) {
    printSection(scenarioTitle);
  }

  const startedAt = new Date().toISOString();
  const healthData = await ensureBackendIsReady(config);
  const preResetProductSnapshot = await resolveTargetProduct(config);

  if (printProgress) {
    console.log(
      `Selected product: ${preResetProductSnapshot.id} (${preResetProductSnapshot.code}) - current stock ${preResetProductSnapshot.stock}`
    );
  }

  const resetResult = await resetProductForTest(config, preResetProductSnapshot.id);
  const beforeProductSnapshot = await fetchProductById(config, preResetProductSnapshot.id);

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

  const postTestData = await fetchPostTestData(config, preResetProductSnapshot.id);
  const afterProductSnapshot = postTestData.afterProductSnapshot.available ? postTestData.afterProductSnapshot.data : null;
  const orders = postTestData.orders.available ? postTestData.orders.data : [];
  const attemptLogs = postTestData.attemptLogs.available ? postTestData.attemptLogs.data : [];
  const statsSnapshot = postTestData.stats.available ? postTestData.stats.data : null;

  const requestSummary = buildRequestSummary(requestResults);
  const orderSummary = buildOrderSummary(orders);
  const attemptLogSummary = buildAttemptLogSummary(requestResults, attemptLogs);
  const consistencyCheck = buildConsistencyCheck(
    config,
    beforeProductSnapshot,
    afterProductSnapshot,
    orderSummary,
    attemptLogSummary
  );
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
    testName: "NO_LOCK_RACE_CONDITION_EVIDENCE",
    timestamp: new Date().toISOString(),
    startedAt
  };
}

module.exports = {
  DEFAULT_CONFIG,
  IMPORTANT_ATTEMPT_ACTIONS,
  buildNoLockScriptConfig,
  printEvidenceSummary,
  printRequestResults,
  runNoLockScenario
};
