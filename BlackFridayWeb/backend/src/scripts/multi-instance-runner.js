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

const MODE_SETTINGS = Object.freeze({
  "no-lock": Object.freeze({
    endpointPath: "/api/purchase/no-lock",
    importantActions: [
      PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_STARTED,
      PURCHASE_LOG_ACTIONS.PRODUCT_READ,
      PURCHASE_LOG_ACTIONS.STOCK_CHECK_PASSED,
      PURCHASE_LOG_ACTIONS.STOCK_CHECK_FAILED,
      PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_STARTED,
      PURCHASE_LOG_ACTIONS.ARTIFICIAL_DELAY_ENDED,
      PURCHASE_LOG_ACTIONS.STOCK_UPDATED,
      PURCHASE_LOG_ACTIONS.ORDER_CREATED,
      PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS,
      PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED
    ],
    terminalFailureActions: [
      PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_FAILED
    ],
    terminalSuccessAction: PURCHASE_LOG_ACTIONS.PURCHASE_NO_LOCK_SUCCESS
  }),
  "with-lock": Object.freeze({
    endpointPath: "/api/purchase/with-lock",
    importantActions: [
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
    ],
    terminalFailureActions: [
      PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE,
      PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_FAILED
    ],
    terminalSuccessAction: PURCHASE_LOG_ACTIONS.PURCHASE_WITH_LOCK_SUCCESS
  })
});

const DEFAULT_CONFIG = Object.freeze({
  baseUrls: [
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ],
  concurrentRequests: 20,
  initialStock: 1,
  adminEmail: "admin@example.com",
  adminPassword: "password",
  mode: "with-lock",
  quantity: 1,
  reportDir: "reports",
  reportEnabled: true,
  requestPrefix: null,
  timeoutMs: 10000,
  userPrefix: "multi-user"
});

function parseMode(value) {
  const normalizedValue = String(value || DEFAULT_CONFIG.mode).trim().toLowerCase();

  if (!MODE_SETTINGS[normalizedValue]) {
    throw new Error(`mode must be one of: ${Object.keys(MODE_SETTINGS).join(", ")}`);
  }

  return normalizedValue;
}

function normalizeBaseUrl(value) {
  return new URL(value).toString();
}

function parseBaseUrls(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error("baseUrls must contain at least one URL");
    }

    return [...new Set(value.map(normalizeBaseUrl))];
  }

  if (value === undefined || value === null || value === "") {
    return [...DEFAULT_CONFIG.baseUrls];
  }

  const normalizedUrls = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);

  if (normalizedUrls.length === 0) {
    throw new Error("baseUrls must contain at least one URL");
  }

  return [...new Set(normalizedUrls)];
}

function parseScriptConfig(argv = process.argv.slice(2), env = process.env, overrides = {}) {
  const argumentsMap = parseArguments(argv);
  const defaults = {
    ...DEFAULT_CONFIG,
    ...overrides
  };
  const mode = parseMode(argumentsMap.mode || env.MODE || defaults.mode);
  const baseUrls = parseBaseUrls(argumentsMap.baseUrls || env.BASE_URLS || defaults.baseUrls.join(","));
  const productId = argumentsMap.productId || env.PRODUCT_ID || defaults.productId;
  const modeSettings = MODE_SETTINGS[mode];

  try {
    return {
      ...defaults,
      adminEmail: argumentsMap.adminEmail || env.ADMIN_EMAIL || env.AUTH_EMAIL || defaults.adminEmail,
      adminPassword: argumentsMap.adminPassword || env.ADMIN_PASSWORD || env.AUTH_PASSWORD || defaults.adminPassword,
      baseUrls,
      concurrentRequests: parsePositiveInteger(
        argumentsMap.requests || argumentsMap.concurrentRequests || env.CONCURRENT_REQUESTS || defaults.concurrentRequests,
        "concurrentRequests"
      ),
      endpointPath: modeSettings.endpointPath,
      importantActions: modeSettings.importantActions,
      initialStock: parsePositiveInteger(
        argumentsMap.stock || argumentsMap.initialStock || env.INITIAL_STOCK || defaults.initialStock,
        "initialStock",
        { min: 0 }
      ),
      mode,
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
        defaults.requestPrefix || `multi-instance-${mode}`
      ),
      terminalFailureActions: modeSettings.terminalFailureActions,
      terminalSuccessAction: modeSettings.terminalSuccessAction,
      timeoutMs: parsePositiveInteger(argumentsMap.timeoutMs || env.REQUEST_TIMEOUT_MS || defaults.timeoutMs, "timeoutMs"),
      userPrefix: parseOptionalString(argumentsMap.userPrefix || env.USER_PREFIX, "userPrefix", defaults.userPrefix)
    };
  } catch (error) {
    throw new Error(`Invalid script configuration: ${error.message}`);
  }
}

async function checkBaseUrlHealth(baseUrl, config) {
  try {
    const response = await requestJson(baseUrl, "GET", "/health", {
      timeoutMs: config.timeoutMs
    });
    const healthData = unwrapApiSuccess(`GET ${new URL("/health", baseUrl).toString()}`, response);

    return {
      available: true,
      baseUrl,
      healthData,
      reason: null,
      serverId: healthData.server?.id || null
    };
  } catch (error) {
    return {
      available: false,
      baseUrl,
      healthData: null,
      reason: error.message,
      serverId: null
    };
  }
}

async function probeBaseUrls(config) {
  const checks = await Promise.all(config.baseUrls.map((baseUrl) => checkBaseUrlHealth(baseUrl, config)));
  const healthyChecks = checks.filter((check) => check.available);
  const unavailableChecks = checks.filter((check) => !check.available);
  const warnings = [];

  if (config.baseUrls.length < 2) {
    warnings.push("Only one base URL was provided. This run cannot fully demonstrate multi-instance behavior.");
  }

  if (unavailableChecks.length > 0) {
    unavailableChecks.forEach((check) => {
      warnings.push(`Backend instance unavailable at ${check.baseUrl}: ${check.reason}`);
    });
  }

  if (healthyChecks.length === 0) {
    throw new Error(
      `No healthy backend instances were found. Checked: ${config.baseUrls.join(", ")}. Start at least one server and try again.`
    );
  }

  if (healthyChecks.length < 2) {
    warnings.push("Fewer than two healthy backend instances were available. Multi-instance proof is limited for this run.");
  }

  return {
    checks,
    controlBaseUrl: healthyChecks[0].baseUrl,
    healthyChecks,
    unavailableChecks,
    warnings
  };
}

async function fetchProductById(baseUrl, adminToken, productId, timeoutMs) {
  const response = await requestJson(baseUrl, "GET", `/api/admin/products/${productId}`, {
    headers: buildAuthorizationHeaders(adminToken),
    timeoutMs
  });

  return unwrapApiSuccess(`GET ${new URL(`/api/admin/products/${productId}`, baseUrl).toString()}`, response);
}

async function resolveTargetProduct(config, controlBaseUrl, adminToken) {
  if (config.productId) {
    return fetchProductById(controlBaseUrl, adminToken, config.productId, config.timeoutMs);
  }

  const response = await requestJson(controlBaseUrl, "GET", "/api/admin/products", {
    headers: buildAuthorizationHeaders(adminToken),
    timeoutMs: config.timeoutMs
  });
  const products = unwrapApiSuccess(`GET ${new URL("/api/admin/products", controlBaseUrl).toString()}`, response);

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("No products found. Create or seed at least one product before running the multi-instance test.");
  }

  return [...products].sort((leftProduct, rightProduct) => {
    if (leftProduct.stock !== rightProduct.stock) {
      return leftProduct.stock - rightProduct.stock;
    }

    return leftProduct.id - rightProduct.id;
  })[0];
}

async function resetProductForTest(config, controlBaseUrl, adminToken, productId) {
  const response = await requestJson(controlBaseUrl, "POST", `/api/admin/products/${productId}/reset`, {
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

  return unwrapApiSuccess(`POST ${new URL(`/api/admin/products/${productId}/reset`, controlBaseUrl).toString()}`, response);
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

function pickTargetBaseUrl(baseUrls, requestIndex) {
  return baseUrls[requestIndex % baseUrls.length];
}

async function executePurchaseRequest(config, productId, requestIndex) {
  const payload = buildPurchasePayload(config, productId, requestIndex);
  const targetBaseUrl = pickTargetBaseUrl(config.baseUrls, requestIndex);
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();

  try {
    const response = await requestJson(targetBaseUrl, "POST", config.endpointPath, {
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
      responseMessage: response.body?.message || null,
      responseMetaRequestId: response.body?.meta?.requestId || null,
      responseMetaServerId: response.body?.meta?.serverId || null,
      responseSuccess: Boolean(response.ok && response.body?.success === true),
      startedAt,
      targetBaseUrl,
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
      responseMessage: null,
      responseMetaRequestId: null,
      responseMetaServerId: null,
      responseSuccess: false,
      startedAt,
      targetBaseUrl,
      transportError: error.message,
      userId: payload.userId
    };
  }
}

async function fetchPostTestData(config, controlBaseUrl, adminToken, productId) {
  const fetchTasks = await Promise.allSettled([
    requestJson(controlBaseUrl, "GET", `/api/admin/products/${productId}`, {
      headers: buildAuthorizationHeaders(adminToken),
      timeoutMs: config.timeoutMs
    }),
    requestJson(controlBaseUrl, "GET", "/api/admin/orders", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(controlBaseUrl, "GET", "/api/admin/attempt-logs", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    }),
    requestJson(controlBaseUrl, "GET", "/api/admin/stats", {
      headers: buildAuthorizationHeaders(adminToken),
      query: { productId },
      timeoutMs: config.timeoutMs
    })
  ]);

  return {
    afterProductSnapshot: extractSettledApiData(
      fetchTasks[0],
      `GET ${new URL(`/api/admin/products/${productId}`, controlBaseUrl).toString()}`
    ),
    attemptLogs: extractSettledApiData(
      fetchTasks[2],
      `GET ${new URL(`/api/admin/attempt-logs?productId=${productId}`, controlBaseUrl).toString()}`
    ),
    orders: extractSettledApiData(
      fetchTasks[1],
      `GET ${new URL(`/api/admin/orders?productId=${productId}`, controlBaseUrl).toString()}`
    ),
    stats: extractSettledApiData(
      fetchTasks[3],
      `GET ${new URL(`/api/admin/stats?productId=${productId}`, controlBaseUrl).toString()}`
    )
  };
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

function buildRequestSummary(requestResults) {
  const durations = requestResults.map((requestResult) => requestResult.durationMs);
  const httpSuccessResponses = requestResults.filter((requestResult) => requestResult.responseSuccess).length;
  const httpFailedResponses = requestResults.length - httpSuccessResponses;
  const networkFailures = requestResults.filter((requestResult) => requestResult.transportError).length;
  const resultCountsByErrorCode = aggregateCounts(requestResults.map(normalizeErrorCode));
  const requestDistribution = aggregateCounts(requestResults.map((requestResult) => requestResult.targetBaseUrl));
  const responseServerDistribution = aggregateCounts(
    requestResults
      .map((requestResult) => requestResult.responseMetaServerId)
      .filter(Boolean)
  );
  const networkFailuresByTargetBaseUrl = aggregateCounts(
    requestResults
      .filter((requestResult) => requestResult.transportError)
      .map((requestResult) => requestResult.targetBaseUrl)
  );

  return {
    averageDurationMs:
      requestResults.length > 0 ? toRoundedMs(durations.reduce((total, value) => total + value, 0) / requestResults.length) : 0,
    failedRequestIds: requestResults.filter((requestResult) => !requestResult.responseSuccess).map((requestResult) => requestResult.requestId),
    httpFailedResponses,
    httpSuccessResponses,
    lockServiceUnavailableResponses: resultCountsByErrorCode.LOCK_SERVICE_UNAVAILABLE || 0,
    lockTimeoutResponses: resultCountsByErrorCode.LOCK_TIMEOUT || 0,
    maxDurationMs: requestResults.length > 0 ? Math.max(...durations) : 0,
    minDurationMs: requestResults.length > 0 ? Math.min(...durations) : 0,
    networkFailures,
    networkFailuresByTargetBaseUrl,
    outOfStockResponses: resultCountsByErrorCode.OUT_OF_STOCK || 0,
    productNotFoundResponses: resultCountsByErrorCode.PRODUCT_NOT_FOUND || 0,
    requestDistribution,
    responseServerDistribution,
    resultCountsByErrorCode,
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

function resolveRequestOutcome(action, config) {
  if (action === config.terminalSuccessAction) {
    return "SUCCESS";
  }

  if (action === PURCHASE_LOG_ACTIONS.LOCK_TIMEOUT_FOR_PURCHASE) {
    return "LOCK_TIMEOUT";
  }

  if (config.terminalFailureActions.includes(action)) {
    return "FAILED";
  }

  return null;
}

function resolveOutcomePriority(outcome) {
  if (outcome === "SUCCESS") {
    return 3;
  }

  if (outcome === "LOCK_TIMEOUT") {
    return 2;
  }

  if (outcome === "FAILED") {
    return 1;
  }

  return 0;
}

function buildAttemptLogSummary(config, requestResults, attemptLogs = []) {
  const requestIdSet = new Set(requestResults.map((requestResult) => requestResult.requestId));
  const relevantLogs = attemptLogs.filter((attemptLog) => requestIdSet.has(attemptLog.requestId));
  const importantLogs = relevantLogs.filter((attemptLog) => config.importantActions.includes(attemptLog.action));
  const logsByRequestId = relevantLogs.reduce((accumulator, attemptLog) => {
    accumulator[attemptLog.requestId] = accumulator[attemptLog.requestId] || [];
    accumulator[attemptLog.requestId].push(attemptLog);
    return accumulator;
  }, {});
  const serverLogDistribution = aggregateCounts(
    relevantLogs.map((attemptLog) => attemptLog.serverId || "UNKNOWN")
  );
  const requestOutcomeMap = {};

  relevantLogs.forEach((attemptLog) => {
    const outcome = resolveRequestOutcome(attemptLog.action, config);

    if (!outcome) {
      return;
    }

    const existingOutcome = requestOutcomeMap[attemptLog.requestId];
    const outcomePriority = resolveOutcomePriority(outcome);

    if (!existingOutcome || outcomePriority >= existingOutcome.priority) {
      requestOutcomeMap[attemptLog.requestId] = {
        outcome,
        priority: outcomePriority,
        requestId: attemptLog.requestId,
        serverId: attemptLog.serverId || existingOutcome?.serverId || "UNKNOWN"
      };
    }
  });

  const requestOutcomes = Object.values(requestOutcomeMap).map((requestOutcome) => ({
    outcome: requestOutcome.outcome,
    requestId: requestOutcome.requestId,
    serverId: requestOutcome.serverId
  }));
  const serverRequestOutcomeDistribution = requestOutcomes.reduce((accumulator, requestOutcome) => {
    const serverId = requestOutcome.serverId || "UNKNOWN";

    accumulator[serverId] = accumulator[serverId] || {
      failed: 0,
      lockTimeout: 0,
      success: 0
    };

    if (requestOutcome.outcome === "SUCCESS") {
      accumulator[serverId].success += 1;
      return accumulator;
    }

    if (requestOutcome.outcome === "LOCK_TIMEOUT") {
      accumulator[serverId].failed += 1;
      accumulator[serverId].lockTimeout += 1;
      return accumulator;
    }

    accumulator[serverId].failed += 1;
    return accumulator;
  }, {});
  const participatingServerIds = [
    ...new Set(
      [
        ...requestResults
          .map((requestResult) => requestResult.responseMetaServerId)
          .filter(Boolean),
        ...relevantLogs
          .map((attemptLog) => attemptLog.serverId)
          .filter(Boolean)
      ]
    )
  ];

  return {
    importantActionCounts: aggregateCounts(importantLogs.map((attemptLog) => attemptLog.action)),
    importantLogs,
    logsByRequestId,
    participatingServerIds,
    requestOutcomes,
    serverLogDistribution,
    serverRequestOutcomeDistribution,
    totalAttemptLogs: relevantLogs.length
  };
}

function buildConsistencyCheck(config, afterProductSnapshot, orderSummary) {
  const finalStock = afterProductSnapshot?.stock ?? null;
  const maxSuccessOrders = config.quantity > 0 ? Math.floor(config.initialStock / config.quantity) : 0;
  const expectedFinalStock = config.initialStock - orderSummary.successOrders * config.quantity;
  const oversellDetected = orderSummary.successOrders > maxSuccessOrders;
  const negativeStockDetected = typeof finalStock === "number" ? finalStock < 0 : null;
  const stockMismatch = typeof finalStock === "number" ? finalStock !== expectedFinalStock : null;

  return {
    dataConsistent:
      typeof finalStock === "number"
        ? oversellDetected !== true && negativeStockDetected !== true && stockMismatch !== true
        : null,
    expectedFinalStock,
    finalStock,
    maxSuccessOrders,
    negativeStockDetected,
    oversellDetected,
    stockMismatch
  };
}

function buildConclusion(config, probeResult, requestSummary, attemptLogSummary, consistencyCheck, dataFetchWarnings) {
  const multiInstanceEvidencePresent = attemptLogSummary.participatingServerIds.length >= 2;
  const serverDownDetected = probeResult.unavailableChecks.length > 0 || requestSummary.networkFailures > 0;

  if (dataFetchWarnings.length > 0) {
    return {
      message: "Multi-instance evidence was collected with warnings. Some post-test data could not be fetched reliably.",
      status: "INCOMPLETE"
    };
  }

  if (config.mode === "with-lock") {
    if (requestSummary.lockServiceUnavailableResponses > 0) {
      return {
        message: "With-lock requests encountered LOCK_SERVICE_UNAVAILABLE. Redis distributed lock was not verified in this run.",
        status: "LOCK_SERVICE_UNAVAILABLE"
      };
    }

    if (serverDownDetected) {
      return {
        message:
          "At least one backend instance was unavailable during the run. The remaining processed requests are reported honestly, but this run is only a partial multi-instance verification.",
        status: consistencyCheck.dataConsistent ? "PARTIAL_PASS" : "PARTIAL_FAIL"
      };
    }

    if (!multiInstanceEvidencePresent) {
      return {
        message:
          "The stock stayed consistent, but the evidence did not show at least two participating backend instances in responses or logs.",
        status: "LIMITED"
      };
    }

    if (consistencyCheck.dataConsistent) {
      return {
        message: "Redis distributed lock kept inventory consistent across multiple backend instances.",
        status: "PASS"
      };
    }

    return {
      message: "With-lock multi-instance flow failed the consistency check. Inspect the collected responses and logs.",
      status: "FAIL"
    };
  }

  if (consistencyCheck.oversellDetected || consistencyCheck.negativeStockDetected || consistencyCheck.stockMismatch) {
    return {
      message: "The no-lock multi-instance flow reproduced an inconsistent inventory state under concurrent requests.",
      status: "RACE_CONDITION_REPRODUCED"
    };
  }

  if (serverDownDetected) {
    return {
      message:
        "Race condition was not reproduced in this run, but one or more backend instances were unavailable. Retry with both servers healthy and higher concurrency.",
      status: "PARTIAL_RUN"
    };
  }

  return {
    message:
      "Race condition was not reproduced in this run. Try increasing CONCURRENT_REQUESTS or NO_LOCK_PURCHASE_DELAY_MS and rerun the scenario.",
    status: "RACE_CONDITION_NOT_REPRODUCED"
  };
}

function buildEnvironmentInfo(config, probeResult) {
  return {
    baseUrls: config.baseUrls,
    controlBaseUrl: probeResult.controlBaseUrl,
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform,
    serverHealthChecks: probeResult.checks.map((check) => ({
      available: check.available,
      baseUrl: check.baseUrl,
      reason: check.reason,
      serverId: check.serverId
    })),
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
      responseServerId: requestResult.responseMetaServerId || "",
      success: requestResult.responseSuccess ? "YES" : "NO",
      targetBaseUrl: requestResult.targetBaseUrl
    }))
  );
}

function printDistributionTable(title, distribution, valueLabel) {
  printSection(title);

  if (Object.keys(distribution).length === 0) {
    console.log("- No data available.");
    return;
  }

  Object.entries(distribution).forEach(([key, value]) => {
    console.log(`- ${key}: ${valueLabel ? `${value} ${valueLabel}` : value}`);
  });
}

function printEvidenceSummary(evidence, title) {
  printSection(title);
  console.log(`Mode: ${evidence.mode}`);
  console.log(`Endpoint: ${evidence.config.endpointPath}`);
  console.log(`Configured Base URLs: ${evidence.baseUrls.join(", ")}`);
  console.log(`Control Base URL: ${evidence.controlBaseUrl}`);
  console.log(`Product ID: ${evidence.beforeProductSnapshot?.id ?? "UNKNOWN"} (${evidence.beforeProductSnapshot?.code ?? "UNKNOWN"})`);
  console.log(`Initial Stock: ${evidence.config.initialStock}`);
  console.log(`Concurrent Requests: ${evidence.config.concurrentRequests}`);
  console.log(`Quantity Per Request: ${evidence.config.quantity}`);
  console.log(`Total Batch Duration: ${evidence.summary.requestSummary.totalBatchDurationMs}ms`);

  printSection("Server Availability");
  evidence.serverHealthChecks.forEach((serverHealthCheck) => {
    if (serverHealthCheck.available) {
      console.log(`- ${serverHealthCheck.baseUrl}: UP (${serverHealthCheck.serverId || "UNKNOWN"})`);
      return;
    }

    console.log(`- ${serverHealthCheck.baseUrl}: DOWN (${serverHealthCheck.reason})`);
  });

  printDistributionTable("Request Distribution", evidence.requestDistribution, "requests");
  printDistributionTable("Response Server Distribution", evidence.responseServerDistribution, "responses");
  printDistributionTable("Server Log Distribution", evidence.serverLogDistribution, "logs");

  printSection("Server Request Outcome Distribution");
  if (Object.keys(evidence.serverRequestOutcomeDistribution).length === 0) {
    console.log("- No terminal request outcomes were found in attempt logs.");
  } else {
    Object.entries(evidence.serverRequestOutcomeDistribution).forEach(([serverId, distribution]) => {
      console.log(
        `- ${serverId}: success=${distribution.success}, failed=${distribution.failed}, lockTimeout=${distribution.lockTimeout}`
      );
    });
  }

  printSection("Order Summary");
  console.log(`- Total Orders: ${evidence.summary.orderSummary.totalOrders}`);
  console.log(`- SUCCESS Orders: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- FAILED Orders: ${evidence.summary.orderSummary.failedOrders}`);

  printSection("Stock Summary");
  console.log(`- Initial Stock: ${evidence.config.initialStock}`);
  console.log(`- Final Stock: ${evidence.afterProductSnapshot?.stock ?? "UNKNOWN"}`);
  console.log(`- Expected Final Stock: ${evidence.consistencyCheck.expectedFinalStock}`);

  printSection("Consistency Check");
  console.log(`- Expected Max Success Orders: ${evidence.consistencyCheck.maxSuccessOrders}`);
  console.log(`- Actual Success Orders: ${evidence.summary.orderSummary.successOrders}`);
  console.log(`- Oversell Detected: ${formatBooleanForOutput(evidence.consistencyCheck.oversellDetected)}`);
  console.log(`- Negative Stock Detected: ${formatBooleanForOutput(evidence.consistencyCheck.negativeStockDetected)}`);
  console.log(`- Stock Mismatch: ${formatBooleanForOutput(evidence.consistencyCheck.stockMismatch)}`);
  console.log(`- Data Consistent: ${formatBooleanForOutput(evidence.consistencyCheck.dataConsistent)}`);

  if (Object.keys(evidence.summary.requestSummary.resultCountsByHttpStatus).length > 0) {
    printDistributionTable("HTTP Status Distribution", evidence.summary.requestSummary.resultCountsByHttpStatus);
  }

  if (Object.keys(evidence.summary.requestSummary.resultCountsByErrorCode).length > 0) {
    printDistributionTable("Error Code Distribution", evidence.summary.requestSummary.resultCountsByErrorCode);
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

async function runMultiInstanceScenario(config, options = {}) {
  const { scenarioTitle = "MULTI-INSTANCE LOAD TEST", printProgress = true } = options;

  if (printProgress) {
    printSection(scenarioTitle);
  }

  const startedAt = new Date().toISOString();
  const probeResult = await probeBaseUrls(config);
  const adminSession = await authenticateAdmin(probeResult.controlBaseUrl, config);

  if (printProgress) {
    console.log(`Control base URL selected for admin operations: ${probeResult.controlBaseUrl}`);
  }

  const preResetProductSnapshot = await resolveTargetProduct(config, probeResult.controlBaseUrl, adminSession.token);

  if (printProgress) {
    console.log(
      `Selected product: ${preResetProductSnapshot.id} (${preResetProductSnapshot.code}) - current stock ${preResetProductSnapshot.stock}`
    );
  }

  const resetResult = await resetProductForTest(config, probeResult.controlBaseUrl, adminSession.token, preResetProductSnapshot.id);
  const beforeProductSnapshot = await fetchProductById(
    probeResult.controlBaseUrl,
    adminSession.token,
    preResetProductSnapshot.id,
    config.timeoutMs
  );

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

  const postTestData = await fetchPostTestData(
    config,
    probeResult.controlBaseUrl,
    adminSession.token,
    preResetProductSnapshot.id
  );
  const afterProductSnapshot = postTestData.afterProductSnapshot.available ? postTestData.afterProductSnapshot.data : null;
  const orders = postTestData.orders.available ? postTestData.orders.data : [];
  const attemptLogs = postTestData.attemptLogs.available ? postTestData.attemptLogs.data : [];
  const statsSnapshot = postTestData.stats.available ? postTestData.stats.data : null;

  const requestSummary = buildRequestSummary(requestResults);
  const orderSummary = buildOrderSummary(orders);
  const attemptLogSummary = buildAttemptLogSummary(config, requestResults, attemptLogs);
  const consistencyCheck = buildConsistencyCheck(config, afterProductSnapshot, orderSummary);
  const dataFetchWarnings = [
    !postTestData.afterProductSnapshot.available
      ? `Could not fetch product snapshot after test: ${postTestData.afterProductSnapshot.errorMessage}`
      : null,
    !postTestData.orders.available ? `Could not fetch orders after test: ${postTestData.orders.errorMessage}` : null,
    !postTestData.attemptLogs.available ? `Could not fetch attempt logs after test: ${postTestData.attemptLogs.errorMessage}` : null,
    !postTestData.stats.available ? `Could not fetch stats after test: ${postTestData.stats.errorMessage}` : null
  ].filter(Boolean);
  const fetchWarnings = [
    ...probeResult.warnings,
    ...dataFetchWarnings
  ];
  const conclusion = buildConclusion(
    config,
    probeResult,
    requestSummary,
    attemptLogSummary,
    consistencyCheck,
    dataFetchWarnings
  );

  return {
    afterProductSnapshot,
    attemptLogs,
    baseUrls: config.baseUrls,
    beforeProductSnapshot,
    conclusion,
    config,
    consistencyCheck,
    controlBaseUrl: probeResult.controlBaseUrl,
    environmentInfo: buildEnvironmentInfo(config, probeResult),
    mode: config.mode,
    orders,
    preResetProductSnapshot,
    requestDistribution: requestSummary.requestDistribution,
    requestResults,
    responseServerDistribution: requestSummary.responseServerDistribution,
    serverHealthChecks: probeResult.checks.map((check) => ({
      available: check.available,
      baseUrl: check.baseUrl,
      reason: check.reason,
      serverId: check.serverId
    })),
    serverLogDistribution: attemptLogSummary.serverLogDistribution,
    serverRequestOutcomeDistribution: attemptLogSummary.serverRequestOutcomeDistribution,
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
    testName: config.mode === "with-lock" ? "MULTI_INSTANCE_WITH_LOCK_TEST" : "MULTI_INSTANCE_NO_LOCK_TEST",
    timestamp: new Date().toISOString(),
    startedAt
  };
}

module.exports = {
  DEFAULT_CONFIG,
  MODE_SETTINGS,
  parseScriptConfig,
  pickTargetBaseUrl,
  printEvidenceSummary,
  printRequestResults,
  runMultiInstanceScenario
};
