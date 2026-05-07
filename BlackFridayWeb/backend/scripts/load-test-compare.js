const { buildConfig, printSummary, runPurchaseLoad, writeReport } = require("./load-test-common");

async function main() {
  const config = buildConfig({
    requests: 20,
    concurrency: 20,
    initialStock: 1
  });
  const noLock = await runPurchaseLoad(
    {
      ...config,
      mode: "no-lock"
    },
    {
      mode: "no-lock"
    }
  );
  const withLock = await runPurchaseLoad(
    {
      ...config,
      mode: "with-lock"
    },
    {
      mode: "with-lock"
    }
  );
  const summary = {
    mode: "COMPARE",
    productId: config.productId,
    initialStock: config.initialStock,
    totalRequests: config.requests,
    concurrency: config.concurrency,
    noLock,
    withLock,
    requirementPassed: noLock.oversellDetected && withLock.requirementPassed,
    timestamp: new Date().toISOString()
  };

  printSummary(noLock);
  printSummary(withLock);
  console.log(`Conclusion: ${summary.requirementPassed ? "No-lock failed and with-lock protected inventory." : "Inspect report; comparison did not meet all expectations."}`);
  writeReport(summary, "compare", config.reportDir);

  if (!withLock.requirementPassed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
