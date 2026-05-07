import { coerceArray, coerceObject } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

function toPositiveInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function toNonNegativeInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function buildSimulationConfig(config = {}) {
  return {
    artificialDelayMs:
      config.artificialDelayMs === undefined || config.artificialDelayMs === ""
        ? undefined
        : toNonNegativeInteger(config.artificialDelayMs, undefined),
    concurrency: toPositiveInteger(config.concurrency ?? config.threads, 20),
    initialStock: toNonNegativeInteger(config.initialStock ?? config.initial_stock, 1),
    productId: toPositiveInteger(config.productId ?? config.product_id, null),
    quantity: toPositiveInteger(config.quantity, 1),
    totalRequests: toPositiveInteger(config.totalRequests ?? config.total_requests ?? config.requests, 20)
  };
}

function normalizeRequestLog(entry, index) {
  const item = coerceObject(entry);

  return {
    id: item.requestId ?? item.id ?? `${index + 1}`,
    thread: item.index ?? index + 1,
    requestId: item.requestId ?? null,
    status: item.status ?? (item.success ? "SUCCESS" : item.reason ?? "FAILED"),
    success: Boolean(item.success),
    reason: item.reason ?? null,
    quantity: item.quantity ?? null,
    stockBefore: item.stockBefore ?? null,
    stockAfter: item.stockAfter ?? null,
    lockWaitMs: item.lockWaitMs ?? null,
    serverInstanceId: item.serverInstanceId ?? null,
    timestamp: item.timestamp ?? null
  };
}

function normalizeEvidenceLog(entry) {
  const item = coerceObject(entry);

  return {
    timestamp: item.timestamp ?? item.createdAt ?? null,
    level: item.result ?? "INFO",
    message: item.message ?? item.action ?? "Log entry",
    action: item.action ?? null,
    requestId: item.requestId ?? null,
    serverInstanceId: item.serverInstanceId ?? null,
    stockBefore: item.stockBefore ?? null,
    stockAfter: item.stockAfter ?? null
  };
}

export function normalizeSimulationResponse(payload) {
  const data = coerceObject(payload);
  const summary = coerceObject(data.summary ?? data);
  const requestLogs = coerceArray(data.requestLogs ?? data.results);
  const evidenceLogs = coerceArray(data.evidenceLogs ?? data.logs);

  return {
    id: data.id ?? null,
    reportPath: data.reportPath ?? null,
    summary: {
      mode: summary.mode ?? data.mode ?? null,
      productId: summary.productId ?? data.productId ?? null,
      totalRequests: Number(summary.totalRequests ?? data.totalRequests ?? requestLogs.length) || 0,
      successCount: Number(summary.successCount ?? data.successCount ?? 0) || 0,
      failedCount: Number(summary.failedCount ?? data.failedCount ?? 0) || 0,
      failureCount: Number(summary.failedCount ?? data.failedCount ?? 0) || 0,
      consistent: summary.requirementPassed ?? data.requirementPassed ?? null,
      oversellDetected: Boolean(summary.oversellDetected ?? data.oversellDetected),
      raceConditionConfirmed: Boolean(summary.raceConditionConfirmed ?? data.raceConditionConfirmed),
      initialStock: summary.initialStock ?? data.initialStock ?? null,
      finalStock: summary.finalStock ?? data.finalStock ?? null,
      stockNegative: Boolean(summary.stockNegative ?? data.stockNegative),
      durationMs: Number(data.durationMs ?? summary.durationMs ?? 0) || null,
      lockWaitAvgMs: Number(summary.lockWaitAvgMs ?? 0) || 0,
      lockTimeoutCount: Number(summary.lockTimeoutCount ?? 0) || 0,
      maxConcurrentRequests: Number(summary.maxConcurrentRequests ?? data.maxConcurrentRequests ?? 0) || 0,
      requirementPassed: Boolean(summary.requirementPassed ?? data.requirementPassed)
    },
    results: requestLogs.map(normalizeRequestLog),
    logs: evidenceLogs.map(normalizeEvidenceLog),
    raw: data
  };
}

export async function runNoLockSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.noLock, {
    auth: false,
    method: "POST",
    body: buildSimulationConfig(config),
    timeoutMs: 60000
  });

  return normalizeSimulationResponse(payload);
}

export async function runWithLockSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.withLock, {
    auth: false,
    method: "POST",
    body: buildSimulationConfig(config),
    timeoutMs: 60000
  });

  return normalizeSimulationResponse(payload);
}

export async function runCompareSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.compare, {
    auth: false,
    method: "POST",
    body: buildSimulationConfig(config),
    timeoutMs: 120000
  });
  const data = coerceObject(payload);

  return {
    id: data.id ?? null,
    source: "compare-endpoint",
    summary: {
      productId: data.productId ?? data.noLock?.productId ?? data.withLock?.productId ?? null,
      totalRequests: data.totalRequests ?? data.noLock?.totalRequests ?? data.withLock?.totalRequests ?? 0,
      initialStock: data.initialStock ?? data.noLock?.initialStock ?? data.withLock?.initialStock ?? null,
      durationMs: (data.noLock?.durationMs ?? 0) + (data.withLock?.durationMs ?? 0),
      conclusion: data.summary?.conclusion ?? null
    },
    noLock: normalizeSimulationResponse(data.noLock),
    withLock: normalizeSimulationResponse(data.withLock),
    metrics: [
      {
        label: "Success",
        noLock: data.noLock?.successCount ?? data.noLock?.summary?.successCount ?? 0,
        withLock: data.withLock?.successCount ?? data.withLock?.summary?.successCount ?? 0,
        verdict: "With-lock must never exceed available stock."
      },
      {
        label: "Oversell",
        noLock: data.noLock?.oversellDetected ? "YES" : "NO",
        withLock: data.withLock?.oversellDetected ? "YES" : "NO",
        verdict: data.withLock?.oversellDetected ? "With-lock failed" : "With-lock protected inventory"
      },
      {
        label: "Final Stock",
        noLock: data.noLock?.finalStock ?? data.noLock?.summary?.finalStock ?? null,
        withLock: data.withLock?.finalStock ?? data.withLock?.summary?.finalStock ?? null,
        verdict: "Final stock should be zero or positive."
      }
    ],
    raw: data
  };
}
