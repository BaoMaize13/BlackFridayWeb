const path = require("node:path");
const os = require("node:os");

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
      SERVER_ID: str({ default: os.hostname() }),
      DB_CLIENT: str({ choices: allowedDatabaseClients, default: "sqlite3" }),
      DB_URL: str({ default: "./data/blackfridayweb.sqlite" }),
      DB_POOL_MIN: num({ default: 1 }),
      DB_POOL_MAX: num({ default: 10 }),
      DB_BUSY_TIMEOUT_MS: num({ default: 5000 }),
      REDIS_URL: url({ default: "redis://localhost:6379/0" }),
      LOG_LEVEL: str({ choices: allowedLogLevels, default: "info" }),
      LOG_PRETTY: bool({ default: process.env.NODE_ENV !== "production" })
    });

    return Object.freeze({ ...validatedEnv });
  } catch (error) {
    process.stderr.write("[config] Environment validation failed.\n");
    process.stderr.write(`${error.message}\n`);
    throw error;
  }
}

module.exports = loadEnvironment();
