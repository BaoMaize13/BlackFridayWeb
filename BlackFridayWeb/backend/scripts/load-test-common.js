const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      continue;
    }

    const normalized = argument.slice(2);
    const equalsIndex = normalized.indexOf("=");

    if (equalsIndex >= 0) {
      parsed[normalized.slice(0, equalsIndex)] = normalized.slice(equalsIndex + 1);
      continue;
    }

    const nextValue = argv[index + 1];

    if (nextValue && !nextValue.startsWith("--")) {
      parsed[normalized] = nextValue;
      index += 1;
    } else {
      parsed[normalized] = "true";
    }
  }

  return parsed;
}

function parseInteger(value, fallbackValue, fieldName, min = 1) {
  const candidate = value === undefined || value === null || value === "" ? fallbackValue : value;
  const parsedValue = Number(candidate);

  if (!Number.isInteger(parsedValue) || parsedValue < min) {
    throw new Error(`${fieldName} must be an integer greater than or equal to ${min}`);
  }

  return parsedValue;
}

function normalizeBaseUrl(value, fallbackValue = "http://localhost:4000") {
  return new URL(value || fallbackValue).toString().replace(/\/$/, "");
}

function normalizeBaseUrls(value, fallbackValue = "http://localhost:5000,http://localhost:5001") {
  return String(value || fallbackValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeBaseUrl(item));
}

function buildConfig(defaults = {}) {
  const args = parseArgs();
  const mode = args.mode || process.env.MODE || defaults.mode || "with-lock";
  const baseUrl = normalizeBaseUrl(args.baseUrl || process.env.BASE_URL || defaults.baseUrl);
  const baseUrls = normalizeBaseUrls(args.baseUrls || process.env.BASE_URLS || defaults.baseUrls);

  return {
    artificialDelayMs:
      args.artificialDelayMs || process.env.ARTIFICIAL_DELAY_MS
        ? parseInteger(args.artificialDelayMs || process.env.ARTIFICIAL_DELAY_MS, undefined, "artificialDelayMs", 0)
        : undefined,
    baseUrl,
    baseUrls,
    concurrency: parseInteger(
      args.concurrency || args.threads || process.env.CONCURRENCY || process.env.CONCURRENT_REQUESTS,
      defaults.concurrency || 20,
      "concurrency"
    ),
    initialStock: parseInteger(
      args.stock || args.initialStock || process.env.INITIAL_STOCK,
      defaults.initialStock ?? 1,
      "initialStock",
      0
    ),
    mode,
    productId: parseInteger(args.productId || process.env.PRODUCT_ID, defaults.productId || 1, "productId"),
    quantity: parseInteger(args.quantity || process.env.QUANTITY, defaults.quantity || 1, "quantity"),
    reportDir: args.reportDir || process.env.REPORT_DIR || defaults.reportDir || "reports",
    requests: parseInteger(
      args.requests || args.totalRequests || process.env.TOTAL_REQUESTS || process.env.CONCURRENT_REQUESTS,
      defaults.requests || 20,
      "requests"
    ),
    timeoutMs: parseInteger(args.timeoutMs || process.env.REQUEST_TIMEOUT_MS, defaults.timeoutMs || 30000, "timeoutMs")
  };
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function requestJson(baseUrl, method, pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  const url = new URL(pathname, baseUrl);

  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  try {
    const response = await fetch(url, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      method,
      signal: controller.signal
    });
    const rawBody = await response.text();
    const body = rawBody ? JSON.parse(rawBody) : null;

    return {
      body,
      ok: response.ok,
      status: response.status,
      url: url.toString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapData(response, label) {
  if (!response.ok || response.body?.success !== true) {
    throw new Error(`${label} failed with status ${response.status}: ${response.body?.message || "Unexpected response"}`);
  }

  return response.body.data;
}

async function resetStock(config, baseUrl = config.baseUrl) {
  const response = await requestJson(baseUrl, "POST", `/api/products/${config.productId}/reset-stock`, {
    body: {
      clearLogs: true,
      clearOrders: true,
      stock: config.initialStock
    },
    timeoutMs: config.timeoutMs
  });

  return unwrapData(response, "Reset stock");
}

async function getProduct(config, baseUrl = config.baseUrl) {
  const response = await requestJson(baseUrl, "GET", `/api/products/${config.productId}`, {
    timeoutMs: config.timeoutMs
  });

  return unwrapData(response, "Get product");
}

function createLimiter(total, concurrency, worker) {
  const results = new Array(total);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < total) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(currentIndex);
    }
  }

  return Promise.all(Array.from({ length: Math.min(total, concurrency) }, () => runWorker())).then(() => results);
}

function endpointForMode(mode) {
  return mode === "no-lock" ? "/api/purchase/no-lock" : "/api/purchase/with-lock";
}

async function sendPurchase(config, requestIndex, options = {}) {
  const mode = options.mode || config.mode;
  const baseUrls = options.baseUrls || [config.baseUrl];
  const baseUrl = baseUrls[requestIndex % baseUrls.length];
  const requestId = `${mode}-load-${Date.now()}-${String(requestIndex + 1).padStart(3, "0")}`;
  const startedAt = Date.now();

  try {
    const response = await requestJson(baseUrl, "POST", endpointForMode(mode), {
      body: {
        artificialDelayMs: mode === "no-lock" ? config.artificialDelayMs : undefined,
        productId: config.productId,
        quantity: config.quantity,
        requestId
      },
      headers: {
        "x-request-id": requestId
      },
      timeoutMs: config.timeoutMs
    });

    return {
      requestId,
      baseUrl,
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      success: response.body?.success === true,
      reason: response.body?.reason || response.body?.error?.code || null,
      stockBefore: response.body?.stockBefore ?? null,
      stockAfter: response.body?.stockAfter ?? null,
      serverInstanceId: response.body?.serverInstanceId || response.body?.meta?.serverId || null,
      response: response.body
    };
  } catch (error) {
    return {
      requestId,
      baseUrl,
      durationMs: Date.now() - startedAt,
      httpStatus: null,
      success: false,
      reason: "NETWORK_ERROR",
      stockBefore: null,
      stockAfter: null,
      serverInstanceId: null,
      error: error.message
    };
  }
}

async function runPurchaseLoad(config, options = {}) {
  const mode = options.mode || config.mode;
  const baseUrls = options.baseUrls || [config.baseUrl];
  const controlBaseUrl = baseUrls[0];

  await resetStock(config, controlBaseUrl);
  const startedAt = Date.now();
  const requestLogs = await createLimiter(config.requests, config.concurrency, (index) =>
    sendPurchase(
      {
        ...config,
        mode
      },
      index,
      {
        baseUrls,
        mode
      }
    )
  );
  const product = await getProduct(config, controlBaseUrl);
  const successCount = requestLogs.filter((entry) => entry.success).length;
  const failedCount = requestLogs.length - successCount;
  const maxSuccess = Math.floor(config.initialStock / config.quantity);
  const expectedFinalStock = config.initialStock - successCount * config.quantity;
  const requiredFinalStock = config.initialStock - maxSuccess * config.quantity;
  const finalStock = product.stock;
  const stockNegative = finalStock < 0;
  const oversellDetected = successCount > maxSuccess || stockNegative || (mode === "no-lock" && finalStock !== expectedFinalStock);
  const requirementPassed =
    mode === "with-lock"
      ? successCount === maxSuccess && failedCount === config.requests - successCount && finalStock === requiredFinalStock && !oversellDetected
      : oversellDetected;

  return {
    mode: mode === "with-lock" ? "WITH_LOCK" : "NO_LOCK",
    productId: config.productId,
    initialStock: config.initialStock,
    totalRequests: config.requests,
    concurrency: config.concurrency,
    quantity: config.quantity,
    successCount,
    failedCount,
    finalStock,
    expectedFinalStock,
    requiredFinalStock,
    oversellDetected,
    stockNegative,
    requirementPassed,
    durationMs: Date.now() - startedAt,
    requestLogs,
    serverInstanceIds: [...new Set(requestLogs.map((entry) => entry.serverInstanceId).filter(Boolean))],
    timestamp: new Date().toISOString()
  };
}

function printSummary(summary) {
  console.log("================ TEST SUMMARY ================");
  console.log(`Mode: ${summary.mode}`);
  console.log(`Initial stock: ${summary.initialStock}`);
  console.log(`Total requests: ${summary.totalRequests}`);
  console.log(`Concurrency: ${summary.concurrency}`);
  console.log(`Success: ${summary.successCount}`);
  console.log(`Failed: ${summary.failedCount}`);
  console.log(`Final stock: ${summary.finalStock}`);
  console.log(`Oversell detected: ${summary.oversellDetected}`);
  console.log(`Stock negative: ${summary.stockNegative}`);
  console.log(`Requirement passed: ${summary.requirementPassed}`);
  if (summary.serverInstanceIds?.length) {
    console.log(`Server instances: ${summary.serverInstanceIds.join(", ")}`);
  }
  console.log("==============================================");
}

function writeReport(summary, prefix, reportDir = "reports") {
  const reportsDirectory = path.resolve(process.cwd(), reportDir);
  fs.mkdirSync(reportsDirectory, { recursive: true });
  const reportPath = path.join(reportsDirectory, `${prefix}-${timestampForFile()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Report: ${reportPath}`);
  return reportPath;
}

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      ...env
    },
    shell: true,
    stdio: "inherit"
  });

  return child;
}

module.exports = {
  buildConfig,
  getProduct,
  normalizeBaseUrls,
  printSummary,
  requestJson,
  resetStock,
  runPurchaseLoad,
  startProcess,
  unwrapData,
  writeReport
};
