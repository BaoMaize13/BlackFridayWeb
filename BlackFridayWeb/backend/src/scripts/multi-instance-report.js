const { buildMarkdownTable, formatBoolean } = require("../reporting/markdown-report.builder");
const { writeJsonReport, writeMarkdownReport } = require("../reporting/report-writer");

function buildDistributionRows(distribution, keyLabel, valueLabel) {
  return Object.entries(distribution || {}).map(([key, value]) => ({
    [keyLabel]: key,
    [valueLabel]: value
  }));
}

function buildServerOutcomeRows(serverRequestOutcomeDistribution = {}) {
  return Object.entries(serverRequestOutcomeDistribution).map(([serverId, distribution]) => ({
    "Failed Requests": distribution.failed,
    "Lock Timeout": distribution.lockTimeout,
    "Server ID": serverId,
    "Success Requests": distribution.success
  }));
}

function buildHealthRows(serverHealthChecks = []) {
  return serverHealthChecks.map((serverHealthCheck) => ({
    "Base URL": serverHealthCheck.baseUrl,
    "Reason": serverHealthCheck.reason ?? "",
    "Server ID": serverHealthCheck.serverId ?? "",
    "Status": serverHealthCheck.available ? "UP" : "DOWN"
  }));
}

function buildMarkdownEvidenceReport(evidence) {
  return `# Multi-Instance ${evidence.mode === "with-lock" ? "With-Lock" : "No-Lock"} Test Report

## Test Configuration
${buildMarkdownTable([
  {
    Field: "Mode",
    Value: evidence.mode
  },
  {
    Field: "Base URLs",
    Value: evidence.baseUrls.join(", ")
  },
  {
    Field: "Control Base URL",
    Value: evidence.controlBaseUrl
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
    Field: "Quantity",
    Value: evidence.config.quantity
  },
  {
    Field: "Endpoint",
    Value: evidence.config.endpointPath
  }
])}

## Server Availability
${buildMarkdownTable(buildHealthRows(evidence.serverHealthChecks))}

## Request Distribution
${buildMarkdownTable(buildDistributionRows(evidence.requestDistribution, "Target Server URL", "Requests"))}

## Response Server Distribution
${buildMarkdownTable(buildDistributionRows(evidence.responseServerDistribution, "Response Server ID", "Responses"))}

## Server Log Distribution
${buildMarkdownTable(buildDistributionRows(evidence.serverLogDistribution, "Server ID", "Logs"))}

## Server Request Outcome Distribution
${buildMarkdownTable(buildServerOutcomeRows(evidence.serverRequestOutcomeDistribution))}

## Order Summary
${buildMarkdownTable([
  {
    Count: evidence.summary.orderSummary.successOrders,
    Status: "SUCCESS"
  },
  {
    Count: evidence.summary.orderSummary.failedOrders,
    Status: "FAILED"
  },
  {
    Count: evidence.summary.orderSummary.totalOrders,
    Status: "TOTAL"
  }
])}

## Stock Summary
${buildMarkdownTable([
  {
    Field: "Initial Stock",
    Value: evidence.config.initialStock
  },
  {
    Field: "Final Stock",
    Value: evidence.afterProductSnapshot?.stock ?? "UNKNOWN"
  },
  {
    Field: "Expected Final Stock",
    Value: evidence.consistencyCheck.expectedFinalStock
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
    Check: "Expected Max Success Orders",
    Result: evidence.consistencyCheck.maxSuccessOrders
  },
  {
    Check: "Actual Success Orders",
    Result: evidence.summary.orderSummary.successOrders
  }
])}

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
  const filePrefix = options.filePrefix || `multi-instance-${evidence.mode}`;
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
