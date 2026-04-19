const fs = require("node:fs");
const path = require("node:path");

const { writeComparisonReportSet } = require("../reporting/report-writer");
const { buildTestSummaryFromEvidence } = require("../utils/metrics.util");
const { parseArguments } = require("./script-helpers");

function resolveReportPath(value, label) {
  if (!value) {
    throw new Error(`Missing ${label} report path.`);
  }

  const absolutePath = path.resolve(process.cwd(), value);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} report file not found: ${absolutePath}`);
  }

  return absolutePath;
}

function loadJsonReport(reportPath) {
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function buildComparisonConclusion(noLockSummary, withLockSummary) {
  if (withLockSummary.consistencyCheck.dataConsistent !== true) {
    return {
      message: "With-lock metrics are inconsistent in this comparison. Do not claim the distributed lock passed.",
      status: "FAIL"
    };
  }

  if (
    noLockSummary.consistencyCheck.oversellDetected === true ||
    noLockSummary.consistencyCheck.negativeStockDetected === true ||
    noLockSummary.consistencyCheck.stockMismatch === true
  ) {
    return {
      message:
        "The comparison shows that no-lock can produce inconsistent stock or overselling, while with-lock keeps inventory consistent.",
      status: "PASS"
    };
  }

  return {
    message:
      "No-lock race condition was not reproduced in this run, but it remains unsafe by design because it reads stock before delay and writes stale data. With-lock stayed consistent in the compared run.",
    status: "PASS_WITH_NOTE"
  };
}

function buildComparisonReport(noLockSummary, withLockSummary, input = {}) {
  return {
    conclusion: buildComparisonConclusion(noLockSummary, withLockSummary),
    noLockSummary,
    notes: {
      noLock: noLockSummary.conclusion.message,
      withLock: withLockSummary.conclusion.message
    },
    sourceReports: {
      noLockReportPath: input.noLockReportPath,
      withLockReportPath: input.withLockReportPath
    },
    testName: "NO_LOCK_VS_WITH_LOCK_COMPARISON_REPORT",
    timestamp: new Date().toISOString(),
    withLockSummary
  };
}

async function main() {
  const parsedArguments = parseArguments();
  const noLockReportPath = resolveReportPath(
    parsedArguments.noLock || process.env.NO_LOCK_REPORT,
    "No-lock"
  );
  const withLockReportPath = resolveReportPath(
    parsedArguments.withLock || process.env.WITH_LOCK_REPORT,
    "With-lock"
  );
  const noLockSummary = buildTestSummaryFromEvidence(loadJsonReport(noLockReportPath));
  const withLockSummary = buildTestSummaryFromEvidence(loadJsonReport(withLockReportPath));

  if (noLockSummary.mode !== "no-lock") {
    throw new Error(`Expected a no-lock report, but received mode='${noLockSummary.mode}'.`);
  }

  if (withLockSummary.mode !== "with-lock") {
    throw new Error(`Expected a with-lock report, but received mode='${withLockSummary.mode}'.`);
  }

  const comparisonReport = buildComparisonReport(noLockSummary, withLockSummary, {
    noLockReportPath,
    withLockReportPath
  });
  const reportPaths = writeComparisonReportSet(comparisonReport, {
    filePrefix: parsedArguments.filePrefix || "comparison-summary",
    reportDir: parsedArguments.reportDir || process.env.REPORT_DIR || "reports"
  });

  console.log("\nLOCK STRATEGY COMPARISON GENERATED");
  console.log("----------------------------------");
  console.log(`No-Lock Report: ${noLockReportPath}`);
  console.log(`With-Lock Report: ${withLockReportPath}`);
  console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
  console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  console.log(`CSV Report: ${reportPaths.csvReportPath}`);
  console.log("\nComparison:");
  console.log(`- No-Lock Conclusion: ${noLockSummary.conclusion.status}`);
  console.log(`- With-Lock Conclusion: ${withLockSummary.conclusion.status}`);
  console.log(`- Final Status: ${comparisonReport.conclusion.status}`);
  console.log(`- ${comparisonReport.conclusion.message}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nLOCK STRATEGY COMPARISON FAILED");
    console.error("-------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildComparisonReport,
  main
};
