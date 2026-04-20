const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");

const { closeTestDatabase, resetTestDatabase } = require("../setup/test-db");
const { getRequestClient } = require("../helpers/request.helper");

beforeEach(async () => {
  await resetTestDatabase();
});

after(async () => {
  await closeTestDatabase();
});

test("POST /api/auth/login returns JWT token and user profile for seeded admin", async () => {
  const client = getRequestClient();
  const response = await client.post("/api/auth/login").send({
    email: "admin@example.com",
    password: "password"
  }).expect(200);

  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.data.token, "string");
  assert.equal(response.body.data.user.email, "admin@example.com");
  assert.equal(response.body.data.user.role, "admin");
  assert.equal(response.body.data.user.passwordHash, undefined);
});

test("GET /api/auth/me returns authenticated user profile", async () => {
  const client = getRequestClient();
  const loginResponse = await client.post("/api/auth/login").send({
    email: "admin@example.com",
    password: "password"
  }).expect(200);

  const response = await client
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${loginResponse.body.data.token}`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.email, "admin@example.com");
  assert.equal(response.body.data.user.role, "admin");
});

test("POST /api/auth/login rejects invalid credentials", async () => {
  const client = getRequestClient();
  const response = await client.post("/api/auth/login").send({
    email: "admin@example.com",
    password: "wrong-password"
  }).expect(401);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "INVALID_CREDENTIALS");
});
