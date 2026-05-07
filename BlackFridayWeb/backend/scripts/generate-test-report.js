const fs = require("node:fs");
const path = require("node:path");

const { buildConfig, writeReport } = require("./load-test-common");

function listJsonReports(reportDir) {
  const reportsDirectory = path.resolve(process.cwd(), reportDir);

  if (!fs.existsSync(reportsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(reportsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const reportPath = path.join(reportsDirectory, fileName);
      const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));

      return {
        fileName,
        mode: data.mode,
        productId: data.productId,
        successCount: data.successCount ?? data.noLock?.successCount ?? null,
        failedCount: data.failedCount ?? data.noLock?.failedCount ?? null,
        oversellDetected: data.oversellDetected ?? data.noLock?.oversellDetected ?? null,
        requirementPassed: data.requirementPassed,
        timestamp: data.timestamp
      };
    })
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

function main() {
  const config = buildConfig({});
  const reports = listJsonReports(config.reportDir);
  const summary = {
    mode: "GENERATED_REPORT_INDEX",
    totalReports: reports.length,
    reports,
    timestamp: new Date().toISOString()
  };

  console.log(`Reports found: ${reports.length}`);
  reports.slice(0, 10).forEach((report) => {
    console.log(`- ${report.fileName}: mode=${report.mode}, passed=${report.requirementPassed}`);
  });
  writeReport(summary, "generated-report", config.reportDir);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
