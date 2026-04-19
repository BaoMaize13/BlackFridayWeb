const { createEvidenceReportFiles } = require("./with-lock-report");
const { parseScriptConfig, printEvidenceSummary, printRequestResults, runWithLockScenario } = require("./with-lock-runner");

async function main() {
  const config = parseScriptConfig(process.argv.slice(2), process.env, {
    requestPrefix: "with-lock-test"
  });
  const evidence = await runWithLockScenario(config, {
    printProgress: true,
    scenarioTitle: "WITH-LOCK CONCURRENCY TEST"
  });

  printRequestResults(evidence.requestResults);
  printEvidenceSummary(evidence, "WITH-LOCK CONCURRENCY TEST RESULT");

  if (config.reportEnabled) {
    const reportPaths = createEvidenceReportFiles(evidence, {
      filePrefix: "with-lock-test-result",
      reportDir: config.reportDir
    });

    console.log("\nReport Files");
    console.log("------------");
    console.log(`JSON Report: ${reportPaths.jsonReportPath}`);
    console.log(`Markdown Report: ${reportPaths.markdownReportPath}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\nWITH-LOCK CONCURRENCY TEST FAILED");
    console.error("----------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
