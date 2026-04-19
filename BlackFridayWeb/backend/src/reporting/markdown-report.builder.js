function formatBoolean(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  return value ? "YES" : "NO";
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function buildMarkdownTable(rows) {
  if (!rows || rows.length === 0) {
    return "_No data available._";
  }

  const headers = Object.keys(rows[0]);
  const headerRow = `| ${headers.map(escapeMarkdownCell).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map((row) => `| ${headers.map((header) => escapeMarkdownCell(row[header])).join(" | ")} |`);

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

function buildDistributionRows(distribution, keyLabel, valueLabel) {
  return Object.entries(distribution || {}).map(([key, value]) => ({
    [keyLabel]: key,
    [valueLabel]: value
  }));
}

function buildServerBreakdownRows(serverBreakdown = {}) {
  return Object.entries(serverBreakdown).map(([serverId, bucket]) => ({
    "FAILED Orders": bucket.failedOrders,
    "HTTP Failed": bucket.httpFailedResponses,
    "HTTP Success": bucket.httpSuccessResponses,
    Logs: bucket.logs,
    "SUCCESS Orders": bucket.successOrders,
    "Server ID": serverId
  }));
}

function buildSummaryMarkdownReport(summary) {
  return `# ${summary.testName}

## Test Configuration
${buildMarkdownTable([
  {
    Field: "Mode",
    Value: summary.mode
  },
  {
    Field: "Is Multi-Instance",
    Value: summary.isMultiInstance ? "YES" : "NO"
  },
  {
    Field: "Product ID",
    Value: summary.config.productId ?? "UNKNOWN"
  },
  {
    Field: "Initial Stock",
    Value: summary.stockMetrics.initialStock ?? "UNKNOWN"
  },
  {
    Field: "Concurrent Requests",
    Value: summary.config.concurrentRequests
  },
  {
    Field: "Quantity",
    Value: summary.config.quantity ?? "UNKNOWN"
  },
  {
    Field: "Base URLs",
    Value: summary.config.baseUrls?.length > 0 ? summary.config.baseUrls.join(", ") : "N/A"
  }
])}

## Request Metrics
${buildMarkdownTable([
  {
    Metric: "Total Requests",
    Value: summary.requestMetrics.totalRequests
  },
  {
    Metric: "HTTP Success Responses",
    Value: summary.requestMetrics.httpSuccessResponses
  },
  {
    Metric: "HTTP Failed Responses",
    Value: summary.requestMetrics.httpFailedResponses
  },
  {
    Metric: "Average Latency (ms)",
    Value: summary.requestMetrics.averageLatencyMs
  },
  {
    Metric: "Min Latency (ms)",
    Value: summary.requestMetrics.minLatencyMs
  },
  {
    Metric: "Max Latency (ms)",
    Value: summary.requestMetrics.maxLatencyMs
  },
  {
    Metric: "P95 Latency (ms)",
    Value: summary.requestMetrics.p95LatencyMs
  }
])}

## Business Metrics
${buildMarkdownTable([
  {
    Metric: "SUCCESS Orders",
    Value: summary.businessMetrics.successOrders
  },
  {
    Metric: "FAILED Orders",
    Value: summary.businessMetrics.failedOrders
  },
  {
    Metric: "Out Of Stock",
    Value: summary.businessMetrics.outOfStockCount
  },
  {
    Metric: "Lock Timeout",
    Value: summary.businessMetrics.lockTimeoutCount
  },
  {
    Metric: "Lock Service Unavailable",
    Value: summary.businessMetrics.lockServiceUnavailableCount
  },
  {
    Metric: "Product Not Found",
    Value: summary.businessMetrics.productNotFoundCount
  }
])}

## Stock Consistency
${buildMarkdownTable([
  {
    Check: "Initial Stock",
    Result: summary.stockMetrics.initialStock ?? "UNKNOWN"
  },
  {
    Check: "Final Stock",
    Result: summary.stockMetrics.finalStock ?? "UNKNOWN"
  },
  {
    Check: "Expected Final Stock",
    Result: summary.stockMetrics.expectedFinalStock ?? "UNKNOWN"
  },
  {
    Check: "Oversell Detected",
    Result: formatBoolean(summary.consistencyCheck.oversellDetected)
  },
  {
    Check: "Negative Stock Detected",
    Result: formatBoolean(summary.consistencyCheck.negativeStockDetected)
  },
  {
    Check: "Stock Mismatch",
    Result: formatBoolean(summary.consistencyCheck.stockMismatch)
  },
  {
    Check: "Data Consistent",
    Result: formatBoolean(summary.consistencyCheck.dataConsistent)
  }
])}
${
  summary.serverMetrics.requestDistribution && Object.keys(summary.serverMetrics.requestDistribution).length > 0
    ? `
## Request Distribution
${buildMarkdownTable(buildDistributionRows(summary.serverMetrics.requestDistribution, "Target URL", "Requests"))}
`
    : ""
}
${
  summary.serverMetrics.logDistribution && Object.keys(summary.serverMetrics.logDistribution).length > 0
    ? `
## Server Log Distribution
${buildMarkdownTable(buildDistributionRows(summary.serverMetrics.logDistribution, "Server ID", "Logs"))}
`
    : ""
}
${
  summary.serverMetrics.serverBreakdown && Object.keys(summary.serverMetrics.serverBreakdown).length > 0
    ? `
## Server Breakdown
${buildMarkdownTable(buildServerBreakdownRows(summary.serverMetrics.serverBreakdown))}
`
    : ""
}
## Conclusion
- Status: ${summary.conclusion.status}
- ${summary.conclusion.message}
${
  summary.consistencyCheck.note
    ? `\n## Consistency Note\n- ${summary.consistencyCheck.note}\n`
    : ""
}
${
  summary.serverMetrics.limitations?.length > 0 || summary.sourceWarnings?.length > 0
    ? `\n## Limitations\n${[...(summary.serverMetrics.limitations || []), ...(summary.sourceWarnings || [])]
        .map((item) => `- ${item}`)
        .join("\n")}\n`
    : ""
}
`;
}

function buildComparisonMarkdownReport(comparisonReport) {
  const noLockSummary = comparisonReport.noLockSummary;
  const withLockSummary = comparisonReport.withLockSummary;

  return `# No-Lock vs With-Lock Comparison Report

## Test Setup
${buildMarkdownTable([
  {
    Field: "Initial Stock",
    "No-Lock": noLockSummary.stockMetrics.initialStock ?? "UNKNOWN",
    "With-Lock": withLockSummary.stockMetrics.initialStock ?? "UNKNOWN"
  },
  {
    Field: "Concurrent Requests",
    "No-Lock": noLockSummary.config.concurrentRequests,
    "With-Lock": withLockSummary.config.concurrentRequests
  },
  {
    Field: "Quantity",
    "No-Lock": noLockSummary.config.quantity ?? "UNKNOWN",
    "With-Lock": withLockSummary.config.quantity ?? "UNKNOWN"
  },
  {
    Field: "Mode",
    "No-Lock": noLockSummary.mode,
    "With-Lock": withLockSummary.mode
  }
])}

## Request Metrics
${buildMarkdownTable([
  {
    Metric: "Total Requests",
    "No-Lock": noLockSummary.requestMetrics.totalRequests,
    "With-Lock": withLockSummary.requestMetrics.totalRequests
  },
  {
    Metric: "HTTP Success",
    "No-Lock": noLockSummary.requestMetrics.httpSuccessResponses,
    "With-Lock": withLockSummary.requestMetrics.httpSuccessResponses
  },
  {
    Metric: "HTTP Failed",
    "No-Lock": noLockSummary.requestMetrics.httpFailedResponses,
    "With-Lock": withLockSummary.requestMetrics.httpFailedResponses
  },
  {
    Metric: "Average Latency (ms)",
    "No-Lock": noLockSummary.requestMetrics.averageLatencyMs,
    "With-Lock": withLockSummary.requestMetrics.averageLatencyMs
  },
  {
    Metric: "Max Latency (ms)",
    "No-Lock": noLockSummary.requestMetrics.maxLatencyMs,
    "With-Lock": withLockSummary.requestMetrics.maxLatencyMs
  },
  {
    Metric: "P95 Latency (ms)",
    "No-Lock": noLockSummary.requestMetrics.p95LatencyMs,
    "With-Lock": withLockSummary.requestMetrics.p95LatencyMs
  }
])}

## Business Metrics
${buildMarkdownTable([
  {
    Metric: "SUCCESS Orders",
    "No-Lock": noLockSummary.businessMetrics.successOrders,
    "With-Lock": withLockSummary.businessMetrics.successOrders
  },
  {
    Metric: "FAILED Orders",
    "No-Lock": noLockSummary.businessMetrics.failedOrders,
    "With-Lock": withLockSummary.businessMetrics.failedOrders
  },
  {
    Metric: "Out Of Stock",
    "No-Lock": noLockSummary.businessMetrics.outOfStockCount,
    "With-Lock": withLockSummary.businessMetrics.outOfStockCount
  },
  {
    Metric: "Lock Timeout",
    "No-Lock": "N/A",
    "With-Lock": withLockSummary.businessMetrics.lockTimeoutCount
  },
  {
    Metric: "Lock Service Unavailable",
    "No-Lock": "N/A",
    "With-Lock": withLockSummary.businessMetrics.lockServiceUnavailableCount
  }
])}

## Stock Consistency
${buildMarkdownTable([
  {
    Check: "Initial Stock",
    "No-Lock": noLockSummary.stockMetrics.initialStock ?? "UNKNOWN",
    "With-Lock": withLockSummary.stockMetrics.initialStock ?? "UNKNOWN"
  },
  {
    Check: "Final Stock",
    "No-Lock": noLockSummary.stockMetrics.finalStock ?? "UNKNOWN",
    "With-Lock": withLockSummary.stockMetrics.finalStock ?? "UNKNOWN"
  },
  {
    Check: "Expected Final Stock",
    "No-Lock": noLockSummary.stockMetrics.expectedFinalStock ?? "UNKNOWN",
    "With-Lock": withLockSummary.stockMetrics.expectedFinalStock ?? "UNKNOWN"
  },
  {
    Check: "Oversell Detected",
    "No-Lock": formatBoolean(noLockSummary.consistencyCheck.oversellDetected),
    "With-Lock": formatBoolean(withLockSummary.consistencyCheck.oversellDetected)
  },
  {
    Check: "Negative Stock Detected",
    "No-Lock": formatBoolean(noLockSummary.consistencyCheck.negativeStockDetected),
    "With-Lock": formatBoolean(withLockSummary.consistencyCheck.negativeStockDetected)
  },
  {
    Check: "Stock Mismatch",
    "No-Lock": formatBoolean(noLockSummary.consistencyCheck.stockMismatch),
    "With-Lock": formatBoolean(withLockSummary.consistencyCheck.stockMismatch)
  },
  {
    Check: "Data Consistent",
    "No-Lock": formatBoolean(noLockSummary.consistencyCheck.dataConsistent),
    "With-Lock": formatBoolean(withLockSummary.consistencyCheck.dataConsistent)
  }
])}

## Trade-Off
- No-lock average latency: ${noLockSummary.requestMetrics.averageLatencyMs} ms
- With-lock average latency: ${withLockSummary.requestMetrics.averageLatencyMs} ms
- Interpretation: with-lock can be slower because requests may wait for the Redis distributed lock, but it protects correctness.

## Conclusion
- Status: ${comparisonReport.conclusion.status}
- ${comparisonReport.conclusion.message}
- No-lock note: ${comparisonReport.notes.noLock}
- With-lock note: ${comparisonReport.notes.withLock}
`;
}

module.exports = {
  buildComparisonMarkdownReport,
  buildMarkdownTable,
  buildSummaryMarkdownReport,
  formatBoolean
};
