const { closeDatabase, initializeDatabase, runMigrations } = require("../database/client");
const { logger } = require("../utils/logger");

async function migrateDatabase() {
  await initializeDatabase();
  return runMigrations();
}

if (require.main === module) {
  migrateDatabase()
    .then((result) => {
      logger.info(result, "Database migration script finished");
    })
    .catch((error) => {
      logger.error({ err: error }, "Database migration script failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDatabase();
    });
}

module.exports = {
  migrateDatabase
};
