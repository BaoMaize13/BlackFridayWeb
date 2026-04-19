process.env.APP_NAME = "BlackFridayWeb Backend";
process.env.NODE_ENV = "test";
process.env.HOST = "127.0.0.1";
process.env.PORT = "4000";
process.env.SERVER_ID = "backend-test-node";
process.env.DB_CLIENT = "sqlite3";
process.env.DB_URL = ":memory:";
process.env.DB_POOL_MIN = "1";
process.env.DB_POOL_MAX = "1";
process.env.DB_BUSY_TIMEOUT_MS = "5000";
process.env.NO_LOCK_PURCHASE_DELAY_MS = "5";
process.env.REDIS_URL = "redis://localhost:6379/0";
process.env.LOG_LEVEL = "silent";
process.env.LOG_PRETTY = "false";

const { runAdminApiIntegrationTests } = require("./integration/admin-api.test");
const { runDataLayerIntegrationTests } = require("./integration/data-layer.test");
const { runHealthIntegrationTests } = require("./integration/health.test");
const { runPurchaseNoLockIntegrationTests } = require("./integration/purchase-no-lock.test");

async function runIntegrationTestSuite() {
  await runHealthIntegrationTests();
  await runDataLayerIntegrationTests();
  await runAdminApiIntegrationTests();
  await runPurchaseNoLockIntegrationTests();
}

runIntegrationTestSuite()
  .then(() => {
    console.log("All tests passed.");
  })
  .catch((error) => {
    console.error("Test suite failed.");
    console.error(error);
    process.exit(1);
  });
