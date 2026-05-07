const { buildConfig, printSummary, runPurchaseLoad, writeReport } = require("./load-test-common");

async function main() {
  const config = buildConfig({
    mode: "with-lock",
    requests: 100,
    concurrency: 50,
    initialStock: 10
  });
  const normalizedMode = String(config.mode).toLowerCase() === "no-lock" ? "no-lock" : "with-lock";
  const summary = await runPurchaseLoad(
    {
      ...config,
      mode: normalizedMode
    },
    {
      mode: normalizedMode
    }
  );

  printSummary(summary);
  writeReport(summary, "stress", config.reportDir);

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
