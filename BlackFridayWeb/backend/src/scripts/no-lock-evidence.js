const { createEvidenceReportFiles } = require("./no-lock-report");
const { buildNoLockScriptConfig, printEvidenceSummary, printRequestResults, runNoLockScenario } = require("./no-lock-runner");

function formatBoolean(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  return value ? "YES" : "NO";
}

async function main() {
  const config = buildNoLockScriptConfig(process.argv.slice(2), process.env, {
    requestPrefix: "no-lock-evidence",
    saveReport: true
  });
  const evidence = await runNoLockScenario(config, {
    printProgress: true,
    scenarioTitle: "NO-LOCK EVIDENCE COLLECTION"
  });
  const reportPaths = createEvidenceReportFiles(evidence, {
    filePrefix: "no-lock-evidence"
  });

  printRequestResults(evidence.requestResults);
  printEvidenceSummary(evidence, "NO-LOCK EVIDENCE RESULT");

  console.log("\nNO-LOCK EVIDENCE GENERATED");
  console.log("--------------------------");
  console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
  console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  console.log("\nResult:");
  console.log(`- Oversell Detected: ${formatBoolean(evidence.consistencyCheck.oversellDetected)}`);
  console.log(`- Negative Stock Detected: ${formatBoolean(evidence.consistencyCheck.negativeStockDetected)}`);
  console.log(`- Stock Mismatch: ${formatBoolean(evidence.consistencyCheck.stockMismatch)}`);
  console.log(`- Same Stock Read Detected: ${formatBoolean(evidence.consistencyCheck.sameStockReadDetected)}`);
  console.log(`- Data Consistent: ${formatBoolean(evidence.consistencyCheck.dataConsistent)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nNO-LOCK EVIDENCE GENERATION FAILED");
    console.error("----------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
