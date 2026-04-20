const path = require("node:path");

const env = require("./env");

function detectDatabaseDriver(url) {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }

  if (url.startsWith("mysql://")) {
    return "mysql";
  }

  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) {
    return "mongodb";
  }

  return "unknown";
}

function detectRedisDriver(url) {
  if (url.startsWith("redis://") || url.startsWith("rediss://")) {
    return "redis";
  }

  return "unknown";
}

const appConfig = Object.freeze({
  name: env.APP_NAME,
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test"
});

const serverConfig = Object.freeze({
  host: env.HOST,
  port: env.PORT,
  id: env.SERVER_ID
});

const logConfig = Object.freeze({
  level: env.LOG_LEVEL,
  prettyPrint: env.LOG_PRETTY,
  redactPaths: ["req.headers.authorization", "req.headers.cookie"]
});

const databaseConfig = Object.freeze({
  client: env.DB_CLIENT,
  url: env.DB_URL,
  filename:
    env.DB_CLIENT === "sqlite3"
      ? env.DB_URL === ":memory:"
        ? ":memory:"
        : path.resolve(process.cwd(), env.DB_URL)
      : null,
  driver: env.DB_CLIENT === "sqlite3" ? "sqlite" : detectDatabaseDriver(env.DB_URL),
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX
  },
  busyTimeoutMs: env.DB_BUSY_TIMEOUT_MS
});

const redisConfig = Object.freeze({
  url: env.REDIS_URL,
  driver: detectRedisDriver(env.REDIS_URL)
});

const lockConfig = Object.freeze({
  keyPrefix: env.LOCK_KEY_PREFIX,
  retryIntervalMs: env.LOCK_RETRY_INTERVAL_MS,
  ttlMs: env.LOCK_TTL_MS,
  waitTimeoutMs: env.LOCK_WAIT_TIMEOUT_MS
});

const authConfig = Object.freeze({
  expiresIn: env.JWT_EXPIRES_IN,
  jwtSecret: env.JWT_SECRET
});

const purchaseConfig = Object.freeze({
  noLockDelayMs: env.NO_LOCK_PURCHASE_DELAY_MS
});

module.exports = Object.freeze({
  appConfig,
  authConfig,
  databaseConfig,
  lockConfig,
  logConfig,
  purchaseConfig,
  redisConfig,
  serverConfig
});
