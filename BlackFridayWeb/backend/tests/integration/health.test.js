const assert = require("node:assert/strict");
const express = require("express");

const request = require("supertest");

const { createApp } = require("../../src/app");
const errorMiddleware = require("../../src/middlewares/error.middleware");
const requestContextMiddleware = require("../../src/middlewares/request-context.middleware");
const requestLoggerMiddleware = require("../../src/middlewares/request-logger.middleware");

async function testHealthEndpoint() {
  const app = createApp();
  const response = await request(app).get("/health").set("x-request-id", "phase-2-health-check").expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Service is healthy");
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.appName, "BlackFridayWeb Backend");
  assert.equal(response.body.data.environment, "test");
  assert.equal(response.body.data.server.id, "backend-test-node");
  assert.equal(response.body.data.server.host, "127.0.0.1");
  assert.equal(response.body.data.server.port, 4000);
  assert.equal(typeof response.body.data.timestamp, "string");
  assert.equal(response.body.data.services.database.client, "sqlite3");
  assert.equal(response.body.data.services.database.driver, "sqlite");
  assert.equal(response.body.data.services.redis.driver, "redis");
  assert.equal(response.body.meta.requestId, "phase-2-health-check");
  assert.equal(response.headers["x-request-id"], "phase-2-health-check");
}

async function testNotFoundResponse() {
  const app = createApp();
  const response = await request(app).get("/unknown-route").expect(404);

  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Cannot GET /unknown-route");
  assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
  assert.equal(response.body.meta.path, "/unknown-route");
  assert.equal(typeof response.body.meta.requestId, "string");
}

async function testInternalServerErrorResponse() {
  const app = express();

  app.use(requestContextMiddleware);
  app.use(requestLoggerMiddleware);
  app.get("/boom", (req, res, next) => {
    next(new Error("Unexpected crash"));
  });
  app.use(errorMiddleware);

  const response = await request(app).get("/boom").expect(500);

  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Internal server error");
  assert.equal(response.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(typeof response.body.meta.requestId, "string");
}

async function runHealthIntegrationTests() {
  const testCases = [
    ["GET /health returns service metadata", testHealthEndpoint],
    ["Unknown routes return standardized 404 errors", testNotFoundResponse],
    ["Unhandled errors return standardized 500 responses", testInternalServerErrorResponse]
  ];

  for (const [name, testCase] of testCases) {
    await testCase();
    console.log(`PASS ${name}`);
  }
}

if (require.main === module) {
  runHealthIntegrationTests().catch((error) => {
    console.error("FAIL health integration tests");
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runHealthIntegrationTests
};
