const path = require("node:path");

const dotenv = require("dotenv");
const { bool, cleanEnv, num, port, str, url } = require("envalid");

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  quiet: true
});

const allowedNodeEnvs = ["development", "test", "production"];
const allowedLogLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];
const allowedDatabaseClients = ["sqlite3", "pg"];

function loadEnvironment() {
  try {
    const validatedEnv = cleanEnv(process.env, {
      APP_NAME: str({ default: "BlackFridayWeb Backend" }),
      NODE_ENV: str({ choices: allowedNodeEnvs, default: "development" }),
      HOST: str({ default: "0.0.0.0" }),
      PORT: port({ default: 4000 }),
      SERVER_ID: str({ default: `server-${process.env.PORT || 4000}` }),
      DB_CLIENT: str({ choices: allowedDatabaseClients, default: "sqlite3" }),
      DB_URL: str({ default: "./data/blackfridayweb.sqlite" }),
      DB_POOL_MIN: num({ default: 1 }),
      DB_POOL_MAX: num({ default: 10 }),
      DB_BUSY_TIMEOUT_MS: num({ default: 5000 }),
      NO_LOCK_PURCHASE_DELAY_MS: num({ default: 100 }),
      REDIS_URL: url({ default: "redis://localhost:6379/0" }),
      LOCK_TTL_MS: num({ default: 10000 }),
      LOCK_RETRY_INTERVAL_MS: num({ default: 50 }),
      LOCK_WAIT_TIMEOUT_MS: num({ default: 3000 }),
      LOCK_KEY_PREFIX: str({ default: "lock" }),
      LOG_LEVEL: str({ choices: allowedLogLevels, default: "info" }),
      LOG_PRETTY: bool({ default: process.env.NODE_ENV !== "production" })
    });

    const positiveConfigEntries = [
      ["DB_POOL_MIN", validatedEnv.DB_POOL_MIN],
      ["DB_POOL_MAX", validatedEnv.DB_POOL_MAX],
      ["DB_BUSY_TIMEOUT_MS", validatedEnv.DB_BUSY_TIMEOUT_MS],
      ["LOCK_TTL_MS", validatedEnv.LOCK_TTL_MS],
      ["LOCK_RETRY_INTERVAL_MS", validatedEnv.LOCK_RETRY_INTERVAL_MS],
      ["LOCK_WAIT_TIMEOUT_MS", validatedEnv.LOCK_WAIT_TIMEOUT_MS]
    ];

    for (const [key, value] of positiveConfigEntries) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${key} must be a positive number`);
      }
    }

    if (!validatedEnv.LOCK_KEY_PREFIX.trim()) {
      throw new Error("LOCK_KEY_PREFIX must not be empty");
    }

    return Object.freeze({ ...validatedEnv });
  } catch (error) {
    process.stderr.write("[config] Environment validation failed.\n");
    process.stderr.write(`${error.message}\n`);
    throw error;
  }
}

module.exports = loadEnvironment();
