const { createEvidenceReportFiles } = require("./multi-instance-report");
const { parseScriptConfig, printEvidenceSummary, printRequestResults, runMultiInstanceScenario } = require("./multi-instance-runner");

async function main() {
  const config = parseScriptConfig(process.argv.slice(2), process.env);
  const evidence = await runMultiInstanceScenario(config, {
    printProgress: true,
    scenarioTitle:
      config.mode === "with-lock" ? "MULTI-INSTANCE WITH-LOCK TEST" : "MULTI-INSTANCE NO-LOCK TEST"
  });

  printRequestResults(evidence.requestResults);
  printEvidenceSummary(
    evidence,
    config.mode === "with-lock"
      ? "MULTI-INSTANCE WITH-LOCK TEST RESULT"
      : "MULTI-INSTANCE NO-LOCK TEST RESULT"
  );

  if (config.reportEnabled) {
    const reportPaths = createEvidenceReportFiles(evidence, {
      filePrefix: `multi-instance-${config.mode}`,
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
    console.error("\nMULTI-INSTANCE LOAD TEST FAILED");
    console.error("-------------------------------");
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
