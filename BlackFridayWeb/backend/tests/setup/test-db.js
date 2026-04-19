const { closeDatabase, initializeDatabase, runMigrations } = require("../../src/database/client");
const { resetTestData } = require("../../src/scripts/reset-data");

async function initializeTestDatabase() {
  await initializeDatabase();
  await runMigrations();
}

async function resetTestDatabase() {
  await closeDatabase().catch(() => null);
  await initializeTestDatabase();
  await resetTestData();
}

async function closeTestDatabase() {
  await closeDatabase().catch(() => null);
}

module.exports = {
  closeTestDatabase,
  initializeTestDatabase,
  resetTestDatabase
};
