const { buildMarkdownTable, formatBoolean } = require("../reporting/markdown-report.builder");
const { writeJsonReport, writeMarkdownReport } = require("../reporting/report-writer");

function buildProductSnapshotRows(evidence) {
  return [
    {
      Code: evidence.beforeProductSnapshot?.code ?? "",
      Name: evidence.beforeProductSnapshot?.name ?? "",
      State: "Before Test",
      Stock: evidence.beforeProductSnapshot?.stock ?? "UNKNOWN"
    },
    {
      Code: evidence.afterProductSnapshot?.code ?? "",
      Name: evidence.afterProductSnapshot?.name ?? "",
      State: "After Test",
      Stock: evidence.afterProductSnapshot?.stock ?? "UNKNOWN"
    }
  ];
}

function buildImportantLogRows(evidence, limit = 12) {
  return evidence.summary.attemptLogSummary.importantLogs.slice(0, limit).map((attemptLog) => ({
    Action: attemptLog.action,
    Message: attemptLog.message,
    RequestId: attemptLog.requestId,
    Result: attemptLog.result,
    StockAfter: attemptLog.stockAfter ?? "",
    StockBefore: attemptLog.stockBefore ?? "",
    Timestamp: attemptLog.createdAt
  }));
}

function buildMarkdownEvidenceReport(evidence) {
  const lockEffectivenessText = evidence.consistencyCheck.lockEffectivenessPass ? "PASS" : "FAIL";

  return `# With-Lock Concurrency Test Report

## Test Configuration
${buildMarkdownTable([
  {
    Field: "Base URL",
    Value: evidence.config.baseUrl
  },
  {
    Field: "Product ID",
    Value: evidence.beforeProductSnapshot?.id ?? "UNKNOWN"
  },
  {
    Field: "Initial Stock",
    Value: evidence.config.initialStock
  },
  {
    Field: "Concurrent Requests",
    Value: evidence.config.concurrentRequests
  },
  {
    Field: "Quantity Per Request",
    Value: evidence.config.quantity
  },
  {
    Field: "Endpoint",
    Value: "/purchase/with-lock"
  }
])}

## Product Snapshot
${buildMarkdownTable(buildProductSnapshotRows(evidence))}

## Request Summary
${buildMarkdownTable([
  {
    Metric: "Total Requests",
    Value: evidence.summary.requestSummary.totalRequests
  },
  {
    Metric: "HTTP Success",
    Value: evidence.summary.requestSummary.httpSuccessResponses
  },
  {
    Metric: "HTTP Failed",
    Value: evidence.summary.requestSummary.httpFailedResponses
  },
  {
    Metric: "Lock Timeout",
    Value: evidence.summary.requestSummary.lockTimeoutResponses
  },
  {
    Metric: "Out Of Stock",
    Value: evidence.summary.requestSummary.outOfStockResponses
  }
])}

## Order Summary
${buildMarkdownTable([
  {
    Metric: "Total Orders",
    Value: evidence.summary.orderSummary.totalOrders
  },
  {
    Metric: "SUCCESS Orders",
    Value: evidence.summary.orderSummary.successOrders
  },
  {
    Metric: "FAILED Orders",
    Value: evidence.summary.orderSummary.failedOrders
  }
])}

## Consistency Check
${buildMarkdownTable([
  {
    Check: "Oversell Detected",
    Result: formatBoolean(evidence.consistencyCheck.oversellDetected)
  },
  {
    Check: "Negative Stock Detected",
    Result: formatBoolean(evidence.consistencyCheck.negativeStockDetected)
  },
  {
    Check: "Stock Mismatch",
    Result: formatBoolean(evidence.consistencyCheck.stockMismatch)
  },
  {
    Check: "Data Consistent",
    Result: formatBoolean(evidence.consistencyCheck.dataConsistent)
  },
  {
    Check: "Lock Effectiveness",
    Result: lockEffectivenessText
  }
])}

## Lock Evidence
- Success request IDs: ${
    evidence.summary.orderSummary.requestIdsCreatedSuccessfully.length > 0
      ? evidence.summary.orderSummary.requestIdsCreatedSuccessfully.join(", ")
      : "None"
  }
- Success requests missing LOCK_ACQUIRED_FOR_PURCHASE: ${
    evidence.consistencyCheck.successRequestIdsMissingLockAcquired.length > 0
      ? evidence.consistencyCheck.successRequestIdsMissingLockAcquired.join(", ")
      : "None"
  }
- Success requests missing PURCHASE_WITH_LOCK_SUCCESS: ${
    evidence.consistencyCheck.successRequestIdsMissingCompletion.length > 0
      ? evidence.consistencyCheck.successRequestIdsMissingCompletion.join(", ")
      : "None"
  }
- Success requests reading stockBefore == initialStock: ${
    evidence.consistencyCheck.successReadAtInitialStockRequestIds.length > 0
      ? evidence.consistencyCheck.successReadAtInitialStockRequestIds.join(", ")
      : "None"
  }

## Important Logs Sample
${buildMarkdownTable(buildImportantLogRows(evidence))}

## Conclusion
- Status: ${evidence.conclusion.status}
- ${evidence.conclusion.message}
${
  evidence.summary.fetchWarnings.length > 0
    ? `\n## Warnings\n${evidence.summary.fetchWarnings.map((warning) => `- ${warning}`).join("\n")}`
    : ""
}
`;
}

function createEvidenceReportFiles(evidence, options = {}) {
  const filePrefix = options.filePrefix || "with-lock-evidence";
  const reportDir = options.reportDir || evidence.config.reportDir || "reports";
  const jsonReportPath = writeJsonReport(evidence, {
    filePrefix,
    reportDir,
    timestamp: evidence.timestamp
  });
  const markdownReportPath = writeMarkdownReport(buildMarkdownEvidenceReport(evidence), {
    filePrefix,
    reportDir,
    timestamp: evidence.timestamp
  });

  return {
    jsonReportPath,
    markdownReportPath
  };
}

module.exports = {
  buildMarkdownEvidenceReport,
  createEvidenceReportFiles
};
