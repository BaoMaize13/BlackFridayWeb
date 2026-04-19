function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
}

function buildCsv(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCsvValue).join(",");
  const bodyRows = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));

  return [headerRow, ...bodyRows].join("\n");
}

function buildSummaryCsvRow(summary) {
  return {
    averageLatencyMs: summary.requestMetrics.averageLatencyMs,
    concurrentRequests: summary.config.concurrentRequests,
    conclusionStatus: summary.conclusion.status,
    dataConsistent: summary.consistencyCheck.dataConsistent,
    expectedFinalStock: summary.stockMetrics.expectedFinalStock,
    failedOrders: summary.businessMetrics.failedOrders,
    finalStock: summary.stockMetrics.finalStock,
    initialStock: summary.stockMetrics.initialStock,
    maxLatencyMs: summary.requestMetrics.maxLatencyMs,
    mode: summary.mode,
    negativeStockDetected: summary.consistencyCheck.negativeStockDetected,
    oversellDetected: summary.consistencyCheck.oversellDetected,
    p95LatencyMs: summary.requestMetrics.p95LatencyMs,
    quantity: summary.config.quantity,
    stockMismatch: summary.consistencyCheck.stockMismatch,
    successOrders: summary.businessMetrics.successOrders,
    testName: summary.testName
  };
}

function buildSummaryCsv(summaryOrSummaries) {
  const summaries = Array.isArray(summaryOrSummaries) ? summaryOrSummaries : [summaryOrSummaries];
  return buildCsv(summaries.filter(Boolean).map(buildSummaryCsvRow));
}

function buildComparisonCsv(comparisonReport) {
  return buildSummaryCsv([comparisonReport.noLockSummary, comparisonReport.withLockSummary]);
}

module.exports = {
  buildComparisonCsv,
  buildSummaryCsv
};
