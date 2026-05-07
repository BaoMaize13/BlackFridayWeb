const { buildConfig, printSummary, runPurchaseLoad, writeReport } = require("./load-test-common");

async function main() {
  const config = buildConfig({
    baseUrls: "http://localhost:5000,http://localhost:5001",
    mode: "with-lock",
    requests: 50,
    concurrency: 50,
    initialStock: 1
  });
  const normalizedMode = String(config.mode).toLowerCase() === "no-lock" ? "no-lock" : "with-lock";
  const summary = await runPurchaseLoad(
    {
      ...config,
      baseUrl: config.baseUrls[0],
      mode: normalizedMode
    },
    {
      baseUrls: config.baseUrls,
      mode: normalizedMode
    }
  );

  summary.multiServer = true;
  summary.baseUrls = config.baseUrls;
  printSummary(summary);
  writeReport(summary, "multi-server", config.reportDir);

  if (normalizedMode === "with-lock" && (!summary.requirementPassed || summary.stockNegative || summary.oversellDetected)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
