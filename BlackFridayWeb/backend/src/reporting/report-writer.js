const fs = require("node:fs");
const path = require("node:path");

const { buildComparisonCsv, buildSummaryCsv } = require("./csv-report.builder");
const { buildComparisonMarkdownReport, buildSummaryMarkdownReport } = require("./markdown-report.builder");

function sanitizeFileNamePart(value) {
  return String(value ?? "report")
    .trim()
    .replace(/[<>:"/\\|?*\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeTimestamp(value) {
  return sanitizeFileNamePart(String(value).replace(/[:.]/g, "-"));
}

function ensureReportDirectory(reportDir = "reports") {
  const reportsDirectory = path.resolve(process.cwd(), reportDir);
  fs.mkdirSync(reportsDirectory, { recursive: true });
  return reportsDirectory;
}

function writeTextFile(reportDir, fileName, content) {
  const reportsDirectory = ensureReportDirectory(reportDir);
  const targetPath = path.join(reportsDirectory, fileName);
  fs.writeFileSync(targetPath, content);
  return targetPath;
}

function writeJsonReport(data, options = {}) {
  const timestamp = sanitizeTimestamp(options.timestamp || data?.timestamp || new Date().toISOString());
  const filePrefix = sanitizeFileNamePart(options.filePrefix || "report");
  const fileName = `${filePrefix}-${timestamp}.json`;

  return writeTextFile(options.reportDir, fileName, JSON.stringify(data, null, 2));
}

function writeMarkdownReport(markdown, options = {}) {
  const timestamp = sanitizeTimestamp(options.timestamp || new Date().toISOString());
  const filePrefix = sanitizeFileNamePart(options.filePrefix || "report");
  const fileName = `${filePrefix}-${timestamp}.md`;

  return writeTextFile(options.reportDir, fileName, markdown);
}

function writeCsvReport(csv, options = {}) {
  const timestamp = sanitizeTimestamp(options.timestamp || new Date().toISOString());
  const filePrefix = sanitizeFileNamePart(options.filePrefix || "report");
  const fileName = `${filePrefix}-${timestamp}.csv`;

  return writeTextFile(options.reportDir, fileName, csv);
}

function writeSummaryReportSet(summary, options = {}) {
  const timestamp = options.timestamp || summary.timestamp || new Date().toISOString();
  const filePrefix = options.filePrefix || `metrics-summary-${summary.mode}`;
  const jsonReportPath = writeJsonReport(summary, {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });
  const markdownReportPath = writeMarkdownReport(buildSummaryMarkdownReport(summary), {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });
  const csvReportPath = writeCsvReport(buildSummaryCsv(summary), {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });

  return {
    csvReportPath,
    jsonReportPath,
    markdownReportPath
  };
}

function writeComparisonReportSet(comparisonReport, options = {}) {
  const timestamp = options.timestamp || comparisonReport.timestamp || new Date().toISOString();
  const filePrefix = options.filePrefix || "comparison-report";
  const jsonReportPath = writeJsonReport(comparisonReport, {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });
  const markdownReportPath = writeMarkdownReport(buildComparisonMarkdownReport(comparisonReport), {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });
  const csvReportPath = writeCsvReport(buildComparisonCsv(comparisonReport), {
    filePrefix,
    reportDir: options.reportDir,
    timestamp
  });

  return {
    csvReportPath,
    jsonReportPath,
    markdownReportPath
  };
}

module.exports = {
  ensureReportDirectory,
  sanitizeFileNamePart,
  writeComparisonReportSet,
  writeCsvReport,
  writeJsonReport,
  writeMarkdownReport,
  writeSummaryReportSet
};
