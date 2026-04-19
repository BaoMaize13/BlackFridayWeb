const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const group = process.argv[2] || "all";
const backendRoot = path.resolve(__dirname, "../..");
const testEnvPath = path.resolve(__dirname, "test-env.js");

const testGroups = Object.freeze({
  all: ["unit", "integration", "edge", "concurrency"],
  concurrency: ["concurrency"],
  edge: ["edge"],
  integration: ["integration"],
  unit: ["unit"]
});

function collectTestFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const entries = fs.readdirSync(directoryPath, {
    withFileTypes: true
  });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function getFilesForGroup(targetGroup) {
  const directories = testGroups[targetGroup];

  if (!directories) {
    throw new Error(`Unknown test group '${targetGroup}'. Expected one of: ${Object.keys(testGroups).join(", ")}`);
  }

  return directories.flatMap((directory) =>
    collectTestFiles(path.join(backendRoot, "tests", directory))
  );
}

function main() {
  const files = getFilesForGroup(group);

  if (files.length === 0) {
    console.error(`No test files found for group '${group}'.`);
    process.exit(1);
  }

  const args = [
    "--require",
    testEnvPath,
    "--test-isolation=none",
    "--test-concurrency=1",
    "--test",
    ...files
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: backendRoot,
    env: process.env,
    stdio: "inherit"
  });

  process.exit(result.status ?? 1);
}

main();
