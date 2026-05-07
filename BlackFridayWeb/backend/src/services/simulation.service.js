const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const { ERROR_CODES } = require("../constants/system");
const { OrderRepository, ProductRepository, PurchaseAttemptRepository } = require("../repositories");
const { ensureReportDirectory, writeJsonReport } = require("../reporting/report-writer");
const productService = require("./product.service");
const purchaseService = require("./purchase.service");

const orderRepository = new OrderRepository();
const productRepository = new ProductRepository();
const purchaseAttemptRepository = new PurchaseAttemptRepository();

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildReportId(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function normalizeMode(mode) {
  return String(mode || "").trim().toUpperCase().replace(/-/g, "_");
}

function getModeLabel(mode) {
  return normalizeMode(mode) === "WITH_LOCK" ? "WITH_LOCK" : "NO_LOCK";
}

function buildRequestId(config, mode, index) {
  const prefix = config.requestPrefix || `${String(mode).toLowerCase().replace("_", "-")}-simulation`;
  return `${prefix}-${Date.now()}-${String(index + 1).padStart(3, "0")}`;
}

async function runWithConcurrency(total, concurrency, worker) {
  const results = new Array(total);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < total) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => runWorker())
  );

  return results;
}

function buildRequestLogFromSuccess(result, mode, startedAt, durationMs, index) {
  const stockBefore = result.stockBefore ?? result.stock?.before ?? null;
  const stockAfter = result.stockAfter ?? result.stock?.after ?? result.product?.stock ?? result.updatedProduct?.stock ?? null;

  return {
    index: index + 1,
    requestId: result.requestId,
    mode,
    productId: result.product?.id ?? result.updatedProduct?.id ?? result.order?.productId ?? null,
    quantity: result.quantity ?? result.order?.quantity ?? null,
    success: true,
    reason: null,
    status: "SUCCESS",
    stockBefore,
    stockAfter,
    lockWaitMs: result.lock?.waitMs ?? null,
    lockToken: result.lock?.token ?? null,
    lockKey: result.lock?.key ?? null,
    retryCount: result.lock?.retryCount ?? null,
    releaseStatus: result.lock?.releaseStatus ?? null,
    serverInstanceId: null,
    timestamp: startedAt,
    durationMs
  };
}

function buildRequestLogFromError(error, payload, mode, startedAt, durationMs, index) {
  const details = error?.details || {};
  const reason = error?.errorCode || ERROR_CODES.INTERNAL_ERROR;
  const stockBefore = details.stockBefore ?? details.stock ?? null;

  return {
    index: index + 1,
    requestId: payload.requestId,
    mode,
    productId: details.productId ?? payload.productId,
    quantity: payload.quantity,
    success: false,
    reason,
    status: reason,
    stockBefore,
    stockAfter: details.stockAfter ?? stockBefore,
    lockWaitMs: null,
    lockToken: null,
    lockKey: null,
    retryCount: null,
    releaseStatus: null,
    serverInstanceId: null,
    timestamp: startedAt,
    durationMs,
    message: error?.message || "Request failed"
  };
}

function summarizeEvidenceLogs(logs, requestLogs) {
  const requestIdSet = new Set(requestLogs.map((entry) => entry.requestId));

  return logs
    .filter((entry) => requestIdSet.has(entry.requestId))
    .slice(0, 120)
    .map((entry) => ({
      requestId: entry.requestId,
      action: entry.action,
      result: entry.result,
      productId: entry.productId,
      stockBefore: entry.stockBefore,
      stockAfter: entry.stockAfter,
      serverInstanceId: entry.serverId,
      timestamp: entry.createdAt,
      message: entry.message
    }));
}

function buildConsistencySummary(config, finalProduct, requestLogs, evidenceLogs, mode) {
  const successCount = requestLogs.filter((entry) => entry.success).length;
  const failedCount = requestLogs.length - successCount;
  const maxSuccess = Math.floor(config.initialStock / config.quantity);
  const finalStock = finalProduct?.stock ?? null;
  const expectedFinalStock = config.initialStock - successCount * config.quantity;
  const requiredFinalStock = config.initialStock - maxSuccess * config.quantity;
  const oversellDetected = successCount > maxSuccess;
  const stockNegative = typeof finalStock === "number" ? finalStock < 0 : false;
  const stockMismatch = typeof finalStock === "number" ? finalStock !== expectedFinalStock : false;
  const stockReadGroups = evidenceLogs.reduce((accumulator, entry) => {
    if (!["PRODUCT_READ", "STOCK_READ"].includes(entry.action) || entry.stockBefore === null) {
      return accumulator;
    }

    const key = String(entry.stockBefore);
    accumulator[key] = accumulator[key] || new Set();
    accumulator[key].add(entry.requestId);
    return accumulator;
  }, {});
  const repeatedStockRead = Object.values(stockReadGroups).some((requestIds) => requestIds.size > 1);
  const stockCheckPassedCount = evidenceLogs.filter((entry) =>
    ["STOCK_CHECK_PASSED", "STOCK_CHECK_PASSED_WITH_LOCK"].includes(entry.action)
  ).length;
  const lockWaitValues = requestLogs
    .map((entry) => Number(entry.lockWaitMs))
    .filter((value) => Number.isFinite(value));
  const lockWaitAvgMs =
    lockWaitValues.length > 0
      ? Number((lockWaitValues.reduce((total, value) => total + value, 0) / lockWaitValues.length).toFixed(2))
      : 0;
  const lockTimeoutCount = requestLogs.filter((entry) => entry.reason === ERROR_CODES.LOCK_TIMEOUT).length;

  return {
    mode,
    productId: config.productId,
    totalRequests: config.totalRequests,
    successCount,
    failedCount,
    initialStock: config.initialStock,
    finalStock,
    quantity: config.quantity,
    maxConcurrentRequests: config.concurrency,
    expectedMaxSuccess: maxSuccess,
    expectedFinalStock,
    requiredFinalStock,
    oversellDetected: oversellDetected || stockNegative || (mode === "NO_LOCK" && stockMismatch),
    raceConditionConfirmed:
      mode === "NO_LOCK" &&
      (oversellDetected || stockNegative || stockMismatch || repeatedStockRead || stockCheckPassedCount > maxSuccess),
    stockNegative,
    stockMismatch,
    lockWaitAvgMs,
    lockTimeoutCount,
    requirementPassed:
      mode === "WITH_LOCK"
        ? successCount === maxSuccess && finalStock === requiredFinalStock && !oversellDetected
        : oversellDetected || stockNegative || stockMismatch || repeatedStockRead || stockCheckPassedCount > maxSuccess
  };
}

async function resolveProductId(productId) {
  if (productId) {
    return productId;
  }

  const products = await productRepository.listProducts();

  if (!products.length) {
    throw new Error("No products found. Run database seed before simulation.");
  }

  return products[0].id;
}

class SimulationService {
  async runSimulation(mode, inputConfig = {}, context = {}) {
    const modeLabel = getModeLabel(mode);
    const config = {
      ...inputConfig,
      productId: await resolveProductId(inputConfig.productId)
    };
    const startedAt = new Date().toISOString();
    const startedAtMs = performance.now();

    await productService.resetProductStock(
      config.productId,
      {
        clearLogs: true,
        clearOrders: true,
        stock: config.initialStock
      },
      {
        logger: context.logger
      }
    );

    const requestLogs = await runWithConcurrency(config.totalRequests, config.concurrency, async (index) => {
      const requestStartedAt = new Date().toISOString();
      const requestStartedAtMs = performance.now();
      const payload = {
        artificialDelayMs: modeLabel === "NO_LOCK" ? config.artificialDelayMs : undefined,
        productId: config.productId,
        quantity: config.quantity,
        requestId: buildRequestId(config, modeLabel, index),
        userId: `simulation-user-${String(index + 1).padStart(3, "0")}`
      };

      try {
        const result =
          modeLabel === "WITH_LOCK"
            ? await purchaseService.purchaseWithLock(payload, {
                logger: context.logger,
                requestId: payload.requestId,
                serverId: context.serverId
              })
            : await purchaseService.purchaseWithoutLock(payload, {
                logger: context.logger,
                requestId: payload.requestId,
                serverId: context.serverId
              });

        return buildRequestLogFromSuccess(
          result,
          modeLabel,
          requestStartedAt,
          Number((performance.now() - requestStartedAtMs).toFixed(2)),
          index
        );
      } catch (error) {
        return buildRequestLogFromError(
          error,
          payload,
          modeLabel,
          requestStartedAt,
          Number((performance.now() - requestStartedAtMs).toFixed(2)),
          index
        );
      }
    });

    const [finalProduct, orders, logs] = await Promise.all([
      productRepository.findProductById(config.productId),
      orderRepository.listOrders({ productId: config.productId }),
      purchaseAttemptRepository.listAttemptLogs({ productId: config.productId })
    ]);
    const evidenceLogs = summarizeEvidenceLogs(logs, requestLogs);

    requestLogs.forEach((requestLog) => {
      const relatedLog = evidenceLogs.find((entry) => entry.requestId === requestLog.requestId);
      requestLog.serverInstanceId = relatedLog?.serverInstanceId ?? context.serverId ?? null;
    });

    const summary = buildConsistencySummary(config, finalProduct, requestLogs, evidenceLogs, modeLabel);
    const report = {
      id: `${String(modeLabel).toLowerCase()}-${buildReportId()}`,
      mode: modeLabel,
      productId: config.productId,
      totalRequests: config.totalRequests,
      successCount: summary.successCount,
      failedCount: summary.failedCount,
      initialStock: config.initialStock,
      finalStock: summary.finalStock,
      maxConcurrentRequests: config.concurrency,
      oversellDetected: summary.oversellDetected,
      raceConditionConfirmed: summary.raceConditionConfirmed,
      stockNegative: summary.stockNegative,
      requirementPassed: summary.requirementPassed,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      timestamp: startedAt,
      serverInstanceId: context.serverId ?? null,
      summary,
      requestLogs,
      evidenceLogs,
      orders
    };

    const reportPath = writeJsonReport(report, {
      filePrefix: String(modeLabel).toLowerCase().replace("_", "-"),
      reportDir: "reports",
      timestamp: report.timestamp
    });

    return {
      ...report,
      reportPath
    };
  }

  async compare(config, context = {}) {
    const noLock = await this.runSimulation("NO_LOCK", {
      ...config,
      requestPrefix: config.requestPrefix ? `${config.requestPrefix}-no-lock` : undefined
    }, context);
    const withLock = await this.runSimulation("WITH_LOCK", {
      ...config,
      requestPrefix: config.requestPrefix ? `${config.requestPrefix}-with-lock` : undefined
    }, context);
    const report = {
      id: `compare-${buildReportId()}`,
      mode: "COMPARE",
      productId: config.productId,
      totalRequests: config.totalRequests,
      initialStock: config.initialStock,
      timestamp: new Date().toISOString(),
      noLock,
      withLock,
      summary: {
        noLock: noLock.summary,
        withLock: withLock.summary,
        conclusion:
          noLock.summary.raceConditionConfirmed && withLock.summary.requirementPassed
            ? "No-lock: Race condition occurred. With-lock: Inventory consistency preserved."
            : "Comparison completed. Inspect both summaries before presenting."
      }
    };
    const reportPath = writeJsonReport(report, {
      filePrefix: "compare",
      reportDir: "reports",
      timestamp: report.timestamp
    });

    return {
      ...report,
      reportPath
    };
  }

  listReports() {
    const reportsDirectory = ensureReportDirectory("reports");
    const reports = fs
      .readdirSync(reportsDirectory)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => {
        const reportPath = path.join(reportsDirectory, fileName);
        const raw = fs.readFileSync(reportPath, "utf8");
        const parsed = JSON.parse(raw);

        return {
          id: parsed.id || path.basename(fileName, ".json"),
          fileName,
          mode: parsed.mode || parsed.summary?.mode || "UNKNOWN",
          productId: parsed.productId ?? parsed.summary?.productId ?? null,
          successCount: parsed.successCount ?? parsed.summary?.successCount ?? null,
          failedCount: parsed.failedCount ?? parsed.summary?.failedCount ?? null,
          oversellDetected: parsed.oversellDetected ?? parsed.summary?.oversellDetected ?? null,
          requirementPassed: parsed.requirementPassed ?? parsed.summary?.requirementPassed ?? null,
          timestamp: parsed.timestamp || null,
          path: reportPath
        };
      })
      .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));

    return reports;
  }

  getReport(reportId) {
    const report = this.listReports().find(
      (item) => item.id === reportId || item.fileName === reportId || path.basename(item.fileName, ".json") === reportId
    );

    if (!report) {
      return null;
    }

    return JSON.parse(fs.readFileSync(report.path, "utf8"));
  }
}

module.exports = new SimulationService();
