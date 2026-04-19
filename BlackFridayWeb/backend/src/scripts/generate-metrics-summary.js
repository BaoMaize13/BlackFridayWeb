const fs = require("node:fs");
const path = require("node:path");

const { writeSummaryReportSet } = require("../reporting/report-writer");
const { buildTestSummaryFromEvidence } = require("../utils/metrics.util");
const { parseArguments } = require("./script-helpers");

function resolveInputPath(parsedArguments, env) {
  const inputPath = parsedArguments.input || parsedArguments.report || env.INPUT_REPORT || env.REPORT_JSON;

  if (!inputPath) {
    throw new Error("Missing input report path. Use --input=<path> or set INPUT_REPORT.");
  }

  return path.resolve(process.cwd(), inputPath);
}

function loadJsonReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report file not found: ${reportPath}`);
  }

  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function formatBoolean(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  return value ? "YES" : "NO";
}

async function main() {
  const parsedArguments = parseArguments();
  const inputPath = resolveInputPath(parsedArguments, process.env);
  const rawReport = loadJsonReport(inputPath);
  const summary = buildTestSummaryFromEvidence(rawReport);
  const reportPaths = writeSummaryReportSet(summary, {
    filePrefix: parsedArguments.filePrefix || `metrics-summary-${summary.mode}`,
    reportDir: parsedArguments.reportDir || process.env.REPORT_DIR || "reports"
  });

  console.log("\nMETRICS SUMMARY GENERATED");
  console.log("-------------------------");
  console.log(`Input Report: ${inputPath}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
  console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  console.log(`CSV Report: ${reportPaths.csvReportPath}`);
  console.log("\nSummary:");
  console.log(`- Success Orders: ${summary.businessMetrics.successOrders}`);
  console.log(`- Failed Orders: ${summary.businessMetrics.failedOrders}`);
  console.log(`- Final Stock: ${summary.stockMetrics.finalStock ?? "UNKNOWN"}`);
  console.log(`- Expected Final Stock: ${summary.stockMetrics.expectedFinalStock ?? "UNKNOWN"}`);
  console.log(`- Oversell Detected: ${formatBoolean(summary.consistencyCheck.oversellDetected)}`);
  console.log(`- Data Consistent: ${formatBoolean(summary.consistencyCheck.dataConsistent)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nMETRICS SUMMARY GENERATION FAILED");
    console.error("--------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
