const fs = require("node:fs");
const path = require("node:path");

const knex = require("knex");

const { appConfig, databaseConfig, serverConfig } = require("../config");
const { createLogger } = require("../utils/logger");

const databaseLogger = createLogger({ module: "database" });

let databaseClient = null;

const databaseState = {
  configured: Boolean(databaseConfig.url),
  connected: false,
  lastConnectedAt: null,
  lastError: null
};

function ensureSqliteDirectory() {
  if (databaseConfig.client !== "sqlite3" || !databaseConfig.filename || databaseConfig.filename === ":memory:") {
    return;
  }

  fs.mkdirSync(path.dirname(databaseConfig.filename), { recursive: true });
}

function buildSqlitePoolConfig() {
  return {
    min: 1,
    max: 1,
    afterCreate(connection, done) {
      connection.serialize(() => {
        connection.run("PRAGMA foreign_keys = ON;");
        connection.run(`PRAGMA busy_timeout = ${databaseConfig.busyTimeoutMs};`, (error) => {
          done(error, connection);
        });
      });
    }
  };
}

function buildDatabaseConfig() {
  const migrationsDirectory = path.join(__dirname, "migrations");

  if (databaseConfig.client === "sqlite3") {
    ensureSqliteDirectory();

    return {
      client: "sqlite3",
      connection: {
        filename: databaseConfig.filename
      },
      useNullAsDefault: true,
      pool: buildSqlitePoolConfig(),
      migrations: {
        directory: migrationsDirectory,
        tableName: "schema_migrations"
      }
    };
  }

  return {
    client: "pg",
    connection: {
      application_name: `${appConfig.name}:${serverConfig.id}`,
      connectionString: databaseConfig.url
    },
    pool: {
      min: databaseConfig.pool.min,
      max: databaseConfig.pool.max
    },
    migrations: {
      directory: migrationsDirectory,
      tableName: "schema_migrations"
    }
  };
}

function getDatabaseClient() {
  if (!databaseClient) {
    databaseClient = knex(buildDatabaseConfig());
  }

  return databaseClient;
}

function getQueryExecutor(executor) {
  return executor || getDatabaseClient();
}

async function initializeDatabase() {
  try {
    const client = getDatabaseClient();
    await client.raw("SELECT 1 AS connection_check");

    databaseState.connected = true;
    databaseState.lastConnectedAt = new Date().toISOString();
    databaseState.lastError = null;

    databaseLogger.info(
      {
        database: {
          client: databaseConfig.client,
          driver: databaseConfig.driver,
          target: databaseConfig.client === "sqlite3" ? databaseConfig.filename : databaseConfig.url
        }
      },
      "Database connection established"
    );

    return client;
  } catch (error) {
    databaseState.connected = false;
    databaseState.lastError = error.message;

    databaseLogger.error(
      {
        err: error,
        database: {
          client: databaseConfig.client,
          driver: databaseConfig.driver
        }
      },
      "Database connection failed"
    );

    throw error;
  }
}

async function closeDatabase() {
  if (!databaseClient) {
    return;
  }

  await databaseClient.destroy();
  databaseClient = null;
  databaseState.connected = false;

  databaseLogger.info("Database connection closed");
}

function getDatabaseState() {
  const state = {
    client: databaseConfig.client,
    configured: databaseState.configured,
    connected: databaseState.connected,
    driver: databaseConfig.driver
  };

  if (databaseConfig.client === "sqlite3") {
    state.filename = databaseConfig.filename;
  }

  if (databaseState.lastConnectedAt) {
    state.lastConnectedAt = databaseState.lastConnectedAt;
  }

  if (databaseState.lastError) {
    state.lastError = databaseState.lastError;
  }

  return state;
}

async function runMigrations() {
  const client = getDatabaseClient();
  const [batchNumber, migrationNames] = await client.migrate.latest();

  databaseLogger.info(
    {
      batchNumber,
      migrationNames
    },
    "Database migrations completed"
  );

  return {
    batchNumber,
    migrationNames
  };
}

async function withTransaction(handler) {
  return getDatabaseClient().transaction(async (transaction) => handler(transaction));
}

module.exports = {
  closeDatabase,
  getDatabaseClient,
  getDatabaseState,
  getQueryExecutor,
  initializeDatabase,
  runMigrations,
  withTransaction
};
