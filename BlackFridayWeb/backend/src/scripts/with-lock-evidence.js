const { createEvidenceReportFiles } = require("./with-lock-report");
const { parseScriptConfig, printEvidenceSummary, printRequestResults, runWithLockScenario } = require("./with-lock-runner");
const { formatBooleanForOutput } = require("./script-helpers");

async function main() {
  const config = parseScriptConfig(process.argv.slice(2), process.env, {
    reportEnabled: true,
    requestPrefix: "with-lock-evidence"
  });
  const evidence = await runWithLockScenario(config, {
    printProgress: true,
    scenarioTitle: "WITH-LOCK EVIDENCE COLLECTION"
  });
  const reportPaths = createEvidenceReportFiles(evidence, {
    filePrefix: "with-lock-evidence",
    reportDir: config.reportDir
  });

  printRequestResults(evidence.requestResults);
  printEvidenceSummary(evidence, "WITH-LOCK EVIDENCE RESULT");

  console.log("\nWITH-LOCK EVIDENCE GENERATED");
  console.log("----------------------------");
  console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
  console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  console.log("\nResult:");
  console.log(`- Oversell Detected: ${formatBooleanForOutput(evidence.consistencyCheck.oversellDetected)}`);
  console.log(`- Negative Stock Detected: ${formatBooleanForOutput(evidence.consistencyCheck.negativeStockDetected)}`);
  console.log(`- Stock Mismatch: ${formatBooleanForOutput(evidence.consistencyCheck.stockMismatch)}`);
  console.log(`- Data Consistent: ${formatBooleanForOutput(evidence.consistencyCheck.dataConsistent)}`);
  console.log(`- Lock Effectiveness: ${evidence.consistencyCheck.lockEffectivenessPass ? "PASS" : "FAIL"}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nWITH-LOCK EVIDENCE GENERATION FAILED");
    console.error("------------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
