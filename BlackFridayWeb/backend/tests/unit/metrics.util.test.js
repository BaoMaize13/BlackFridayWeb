const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  calculateConsistencyCheck,
  calculateLatencyMetrics,
  calculateOrderMetrics,
  calculateServerDistribution
} = require("../../src/utils/metrics.util");

test("calculateLatencyMetrics returns zeroed metrics for an empty request list", () => {
  const metrics = calculateLatencyMetrics([]);

  assert.deepEqual(metrics, {
    averageLatencyMs: 0,
    httpFailedResponses: 0,
    httpSuccessResponses: 0,
    maxLatencyMs: 0,
    minLatencyMs: 0,
    networkFailures: 0,
    p95LatencyMs: 0,
    totalRequests: 0
  });
});

test("calculateLatencyMetrics computes average, min, max and p95 correctly", () => {
  const metrics = calculateLatencyMetrics([
    { durationMs: 10, responseSuccess: true },
    { durationMs: 20, responseSuccess: true },
    { durationMs: 30, responseSuccess: false },
    { durationMs: 40, responseSuccess: false, transportError: "connect ECONNREFUSED" }
  ]);

  assert.equal(metrics.totalRequests, 4);
  assert.equal(metrics.httpSuccessResponses, 2);
  assert.equal(metrics.httpFailedResponses, 2);
  assert.equal(metrics.averageLatencyMs, 25);
  assert.equal(metrics.minLatencyMs, 10);
  assert.equal(metrics.maxLatencyMs, 40);
  assert.equal(metrics.p95LatencyMs, 40);
  assert.equal(metrics.networkFailures, 1);
});

test("calculateConsistencyCheck handles consistent, oversell, negative stock, stock mismatch, and quantity > 1 cases", () => {
  const consistent = calculateConsistencyCheck(1, 0, 1, 1);
  const oversell = calculateConsistencyCheck(1, -1, 2, 1);
  const negativeStock = calculateConsistencyCheck(5, -1, 2, 2);
  const stockMismatch = calculateConsistencyCheck(5, 3, 1, 1);
  const quantityGreaterThanOne = calculateConsistencyCheck(5, 1, 2, 2);

  assert.equal(consistent.oversellDetected, false);
  assert.equal(consistent.negativeStockDetected, false);
  assert.equal(consistent.stockMismatch, false);
  assert.equal(consistent.dataConsistent, true);
  assert.equal(consistent.maxSuccessOrders, 1);

  assert.equal(oversell.oversellDetected, true);
  assert.equal(oversell.negativeStockDetected, true);
  assert.equal(oversell.dataConsistent, false);

  assert.equal(negativeStock.oversellDetected, false);
  assert.equal(negativeStock.negativeStockDetected, true);
  assert.equal(negativeStock.dataConsistent, false);

  assert.equal(stockMismatch.oversellDetected, false);
  assert.equal(stockMismatch.stockMismatch, true);
  assert.equal(stockMismatch.dataConsistent, false);

  assert.equal(quantityGreaterThanOne.maxSuccessOrders, 2);
  assert.equal(quantityGreaterThanOne.expectedFinalStock, 1);
  assert.equal(quantityGreaterThanOne.dataConsistent, true);
});

test("calculateOrderMetrics counts success and failed orders correctly", () => {
  const metrics = calculateOrderMetrics([
    {
      failureReason: null,
      quantity: 2,
      requestId: "req-001",
      status: "SUCCESS"
    },
    {
      failureReason: "OUT_OF_STOCK",
      quantity: 1,
      requestId: "req-002",
      status: "FAILED"
    },
    {
      failureReason: "OUT_OF_STOCK",
      quantity: 1,
      requestId: "req-003",
      status: "FAILED"
    }
  ]);

  assert.equal(metrics.totalOrders, 3);
  assert.equal(metrics.successOrders, 1);
  assert.equal(metrics.failedOrders, 2);
  assert.equal(metrics.successfulOrderedQuantity, 2);
  assert.equal(metrics.ordersByStatus.SUCCESS, 1);
  assert.equal(metrics.ordersByStatus.FAILED, 2);
  assert.equal(metrics.ordersByFailureReason.OUT_OF_STOCK, 2);
});

test("calculateServerDistribution groups by targetBaseUrl and serverId correctly", () => {
  const metrics = calculateServerDistribution({
    orders: [
      { requestId: "req-001", status: "SUCCESS" },
      { requestId: "req-002", status: "FAILED" },
      { requestId: "req-003", status: "SUCCESS" }
    ],
    requestResults: [
      { requestId: "req-001", responseMetaServerId: "server-A", responseSuccess: true, targetBaseUrl: "http://localhost:3000" },
      { requestId: "req-002", responseMetaServerId: "server-B", responseSuccess: false, targetBaseUrl: "http://localhost:3001" },
      { requestId: "req-003", responseMetaServerId: "server-A", responseSuccess: true, targetBaseUrl: "http://localhost:3000" }
    ],
    attemptLogs: [
      { action: "PURCHASE_WITH_LOCK_SUCCESS", requestId: "req-001", serverId: "server-A" },
      { action: "PURCHASE_WITH_LOCK_FAILED", requestId: "req-002", serverId: "server-B" },
      { action: "PURCHASE_WITH_LOCK_SUCCESS", requestId: "req-003", serverId: "server-A" }
    ]
  });

  assert.equal(metrics.requestDistribution["http://localhost:3000"], 2);
  assert.equal(metrics.requestDistribution["http://localhost:3001"], 1);
  assert.equal(metrics.responseServerDistribution["server-A"], 2);
  assert.equal(metrics.responseServerDistribution["server-B"], 1);
  assert.equal(metrics.logDistribution["server-A"], 2);
  assert.equal(metrics.logDistribution["server-B"], 1);
  assert.equal(metrics.successOrdersByServerId["server-A"], 2);
  assert.equal(metrics.failedOrdersByServerId["server-B"], 1);
  assert.equal(metrics.serverBreakdown["server-A"].httpSuccessResponses, 2);
  assert.equal(metrics.serverBreakdown["server-B"].httpFailedResponses, 1);
});
