const fs = require("node:fs");
const path = require("node:path");

function sanitizeTimestamp(value) {
  return value.replace(/[:.]/g, "-");
}

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

function buildProductSnapshotRows(evidence) {
  return [
    {
      Code: evidence.preResetProductSnapshot?.code ?? "",
      Name: evidence.preResetProductSnapshot?.name ?? "",
      State: "Before Reset",
      Stock: evidence.preResetProductSnapshot?.stock ?? "UNKNOWN"
    },
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
  const oversellText = formatBoolean(evidence.consistencyCheck.oversellDetected);
  const negativeStockText = formatBoolean(evidence.consistencyCheck.negativeStockDetected);
  const stockMismatchText = formatBoolean(evidence.consistencyCheck.stockMismatch);
  const sameStockReadText = formatBoolean(evidence.consistencyCheck.sameStockReadDetected);
  const repeatedReadLines =
    evidence.consistencyCheck.sameStockReadGroups.length > 0
      ? evidence.consistencyCheck.sameStockReadGroups.map(
          (group) => `- Requests ${group.requestIds.join(", ")} cùng đọc stockBefore = ${group.stockBefore}`
        )
      : ["- Không phát hiện nhiều request cùng đọc cùng một stock snapshot trong lần chạy này."];

  return `# No-Lock Race Condition Evidence Report

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
    Field: "Request Prefix",
    Value: evidence.config.requestPrefix
  }
])}

## Environment Info
${buildMarkdownTable([
  {
    Field: "App Name",
    Value: evidence.environmentInfo.appName
  },
  {
    Field: "Environment",
    Value: evidence.environmentInfo.appEnvironment
  },
  {
    Field: "Server ID",
    Value: evidence.environmentInfo.server?.id ?? "UNKNOWN"
  },
  {
    Field: "Node Version",
    Value: evidence.environmentInfo.nodeVersion
  },
  {
    Field: "Platform",
    Value: evidence.environmentInfo.platform
  },
  {
    Field: "Timezone",
    Value: evidence.environmentInfo.timezone
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
    Metric: "Order SUCCESS",
    Value: evidence.summary.orderSummary.successOrders
  },
  {
    Metric: "Order FAILED",
    Value: evidence.summary.orderSummary.failedOrders
  },
  {
    Metric: "Final Stock",
    Value: evidence.afterProductSnapshot?.stock ?? "UNKNOWN"
  }
])}

## Consistency Check
${buildMarkdownTable([
  {
    Check: "Oversell Detected",
    Result: oversellText
  },
  {
    Check: "Negative Stock Detected",
    Result: negativeStockText
  },
  {
    Check: "Stock Mismatch",
    Result: stockMismatchText
  },
  {
    Check: "Same Stock Read Detected",
    Result: sameStockReadText
  },
  {
    Check: "Expected Max Success Orders",
    Result: evidence.consistencyCheck.expectedMaxSuccessOrders
  },
  {
    Check: "Actual Success Orders",
    Result: evidence.summary.orderSummary.successOrders
  },
  {
    Check: "Expected Final Stock",
    Result: evidence.consistencyCheck.expectedFinalStock
  }
])}

## Important Evidence
${repeatedReadLines.join("\n")}
- STOCK_CHECK_PASSED request count: ${evidence.consistencyCheck.stockCheckPassedRequestIds.length}
- Success order request IDs: ${
    evidence.summary.orderSummary.requestIdsCreatedSuccessfully.length > 0
      ? evidence.summary.orderSummary.requestIdsCreatedSuccessfully.join(", ")
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
  const reportsDirectory = path.resolve(process.cwd(), "reports");
  const timestamp = sanitizeTimestamp(evidence.timestamp);
  const filePrefix = options.filePrefix || "no-lock-evidence";
  const jsonReportPath = path.join(reportsDirectory, `${filePrefix}-${timestamp}.json`);
  const markdownReportPath = path.join(reportsDirectory, `${filePrefix}-${timestamp}.md`);

  fs.mkdirSync(reportsDirectory, { recursive: true });
  fs.writeFileSync(jsonReportPath, JSON.stringify(evidence, null, 2));
  fs.writeFileSync(markdownReportPath, buildMarkdownEvidenceReport(evidence));

  return {
    jsonReportPath,
    markdownReportPath
  };
}

module.exports = {
  buildMarkdownEvidenceReport,
  createEvidenceReportFiles
};
