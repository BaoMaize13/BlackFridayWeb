import { coerceObject, normalizeLog } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";
import { AppError } from "../../utils/errors";
import { getStoredSession } from "../../utils/storage";

function toPositiveInteger(value, fallback) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue;
}

function resolveActorUserId() {
  const storedSession = getStoredSession();
  const userId = storedSession?.user?.id ?? storedSession?.user?.email ?? null;

  if (!userId) {
    throw new AppError("Please log in before running a simulation.", {
      status: 401,
      errorCode: "UNAUTHORIZED"
    });
  }

  return String(userId);
}

function buildSimulationConfig(config = {}) {
  return {
    initialStock: Number(config.initialStock ?? config.initial_stock ?? 1) || 1,
    productId: Number(config.productId ?? config.product_id),
    quantity: toPositiveInteger(config.quantity, 1),
    totalRequests: toPositiveInteger(config.totalRequests ?? config.total_requests ?? config.threads, 20)
  };
}

function buildRequestId(prefix, requestIndex) {
  return `${prefix}-${Date.now()}-${String(requestIndex + 1).padStart(3, "0")}`;
}

async function resetSimulationProduct(productId, initialStock) {
  await apiClient.request(endpoints.admin.resetProduct(productId), {
    method: "POST",
    body: {
      clearLogs: true,
      clearOrders: true,
      stock: initialStock
    }
  });
}

function buildResultRow(entry, index) {
  const data = coerceObject(entry.response?.data);
  const stock = coerceObject(data.stock);
  const order = coerceObject(data.order);

  return {
    id: entry.requestId,
    thread: index + 1,
    status: entry.success ? (order.status ?? "SUCCESS") : entry.errorCode ?? "FAILED",
    quantity: data.quantity ?? order.quantity ?? entry.quantity,
    stockBefore: data.stockBefore ?? stock.before ?? null,
    stockAfter: data.stockAfter ?? stock.after ?? null,
    lockWaitMs: null,
    timestamp: entry.timestamp
  };
}

function buildSimulationSummary(mode, config, metrics, durationMs) {
  return {
    productId: metrics.productId ?? config.productId,
    totalRequests: config.totalRequests,
    successCount: metrics.orders?.success ?? 0,
    failureCount: metrics.orders?.failed ?? 0,
    consistent: metrics.consistencyCheck?.dataConsistent ?? null,
    oversellDetected: metrics.consistencyCheck?.oversellDetected ?? null,
    initialStock: metrics.stockMetrics?.initialStock ?? config.initialStock,
    finalStock: metrics.stockMetrics?.finalStock ?? null,
    durationMs,
    lockType: mode === "with-lock" ? "redis-distributed-lock" : null,
    waitingQueue: null,
    contentionCount: mode === "with-lock" ? metrics.errors?.lockTimeout ?? 0 : 0
  };
}

async function runSimulation(mode, inputConfig) {
  const config = buildSimulationConfig(inputConfig);

  if (!config.productId) {
    throw new AppError("A numeric productId is required before running the simulation.", {
      status: 400,
      errorCode: "VALIDATION_ERROR"
    });
  }

  const actorUserId = resolveActorUserId();
  const endpoint = mode === "with-lock" ? endpoints.purchase.withLock : endpoints.purchase.noLock;
  const requestPrefix = mode === "with-lock" ? "with-lock-sim" : "no-lock-sim";

  await resetSimulationProduct(config.productId, config.initialStock);

  const startedAt = performance.now();
  const requestEntries = await Promise.all(
    Array.from({ length: config.totalRequests }, async (_, requestIndex) => {
      const requestId = buildRequestId(requestPrefix, requestIndex);
      const timestamp = new Date().toISOString();

      try {
        const response = await apiClient.request(endpoint, {
          method: "POST",
          body: {
            productId: config.productId,
            quantity: config.quantity,
            requestId,
            userId: actorUserId
          }
        });

        return {
          errorCode: null,
          quantity: config.quantity,
          requestId,
          response,
          success: true,
          timestamp
        };
      } catch (error) {
        return {
          errorCode: error.errorCode ?? error.code ?? "FAILED",
          message: error.message,
          quantity: config.quantity,
          requestId,
          response: null,
          success: false,
          timestamp
        };
      }
    })
  );
  const durationMs = Math.round(performance.now() - startedAt);
  const metricsPayload = await apiClient.request(endpoints.admin.metrics, {
    query: {
      includeLogs: true,
      includeServerBreakdown: mode === "with-lock",
      initialStock: config.initialStock,
      productId: config.productId,
      quantity: config.quantity
    }
  });
  const metrics = coerceObject(metricsPayload);

  return {
    summary: buildSimulationSummary(mode, config, metrics, durationMs),
    results: requestEntries.map(buildResultRow),
    logs: (metrics.attemptLogs?.items ?? []).map((entry) => normalizeLog(entry)),
    raw: {
      metrics,
      requestEntries
    }
  };
}

function buildCompareMetrics(noLock, withLock) {
  return [
    {
      label: "Success Count",
      noLock: noLock.summary.successCount,
      withLock: withLock.summary.successCount,
      verdict: withLock.summary.successCount >= noLock.summary.successCount
        ? "Protected flow preserved at least the same successful throughput."
        : "Protected flow reduced successful throughput."
    },
    {
      label: "Failure Count",
      noLock: noLock.summary.failureCount,
      withLock: withLock.summary.failureCount,
      verdict: withLock.summary.failureCount <= noLock.summary.failureCount
        ? "Protected flow reduced failed outcomes."
        : "Protected flow returned more failed outcomes."
    },
    {
      label: "Oversell Detected",
      noLock: noLock.summary.oversellDetected ? "YES" : "NO",
      withLock: withLock.summary.oversellDetected ? "YES" : "NO",
      verdict:
        noLock.summary.oversellDetected && !withLock.summary.oversellDetected
          ? "Distributed locking removed oversell in this compared run."
          : "Oversell difference was not fully eliminated in current data."
    },
    {
      label: "Consistency",
      noLock: noLock.summary.consistent === false ? "BROKEN" : "OK",
      withLock: withLock.summary.consistent === false ? "BROKEN" : "OK",
      verdict:
        noLock.summary.consistent === false && withLock.summary.consistent !== false
          ? "Distributed locking restored consistency."
          : "Consistency difference was not strong in current data."
    }
  ];
}

export async function runNoLockSimulation(config) {
  return runSimulation("no-lock", config);
}

export async function runWithLockSimulation(config) {
  return runSimulation("with-lock", config);
}

export async function runCompareSimulation(config) {
  const noLock = await runSimulation("no-lock", config);
  const withLock = await runSimulation("with-lock", config);

  return {
    summary: {
      productId: noLock.summary.productId ?? withLock.summary.productId,
      totalRequests: noLock.summary.totalRequests,
      initialStock: noLock.summary.initialStock,
      durationMs: (noLock.summary.durationMs ?? 0) + (withLock.summary.durationMs ?? 0)
    },
    noLock,
    withLock,
    metrics: buildCompareMetrics(noLock, withLock)
  };
}
