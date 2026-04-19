const { createEvidenceReportFiles } = require("./no-lock-report");
const { buildNoLockScriptConfig, printEvidenceSummary, printRequestResults, runNoLockScenario } = require("./no-lock-runner");

async function main() {
  const config = buildNoLockScriptConfig(process.argv.slice(2), process.env, {
    requestPrefix: "no-lock-test"
  });
  const evidence = await runNoLockScenario(config, {
    printProgress: true,
    scenarioTitle: "NO-LOCK CONCURRENCY TEST"
  });

  printRequestResults(evidence.requestResults);
  printEvidenceSummary(evidence, "NO-LOCK CONCURRENCY TEST RESULT");

  if (config.saveReport) {
    const reportPaths = createEvidenceReportFiles(evidence, {
      filePrefix: "no-lock-test-result"
    });

    console.log("\nReport Files");
    console.log("------------");
    console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
    console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nNO-LOCK CONCURRENCY TEST FAILED");
    console.error("--------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
