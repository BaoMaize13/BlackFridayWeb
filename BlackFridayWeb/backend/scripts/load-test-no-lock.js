const { buildConfig, printSummary, runPurchaseLoad, writeReport } = require("./load-test-common");

async function main() {
  const config = buildConfig({
    mode: "no-lock",
    requests: 20,
    concurrency: 20,
    initialStock: 1
  });
  const summary = await runPurchaseLoad(
    {
      ...config,
      mode: "no-lock"
    },
    {
      mode: "no-lock"
    }
  );

  printSummary(summary);
  writeReport(summary, "no-lock", config.reportDir);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
