const http = require("node:http");

const { appConfig, serverConfig } = require("./config");
const { closeDatabase, getDatabaseState, initializeDatabase } = require("./database/client");
const { disconnectRedis, getRedisState } = require("./config/redis");
const { createApp } = require("./app");
const { logger } = require("./utils/logger");

function registerShutdownHandlers(server) {
  const shutdownSignals = ["SIGINT", "SIGTERM"];

  shutdownSignals.forEach((signal) => {
    process.once(signal, async () => {
      logger.info({ signal }, "Shutdown signal received");

      server.close(async (error) => {
        if (error) {
          logger.error({ err: error }, "Server shutdown failed");
          process.exit(1);
        }

        try {
          await closeDatabase();
          await disconnectRedis();
          logger.info("HTTP server closed");
          process.exit(0);
        } catch (closeError) {
          logger.error({ err: closeError }, "Service shutdown failed");
          process.exit(1);
        }
      });
    });
  });
}

async function startServer() {
  await initializeDatabase();

  const app = createApp();
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(serverConfig.port, serverConfig.host, () => {
      registerShutdownHandlers(server);

      logger.info(
        {
          appName: appConfig.name,
          environment: appConfig.env,
          server: {
            host: serverConfig.host,
            id: serverConfig.id,
            port: serverConfig.port
          },
          services: {
            database: getDatabaseState(),
            redis: getRedisState()
          }
        },
        "HTTP server started"
      );

      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.fatal({ err: error }, "Failed to start HTTP server");
    process.exit(1);
  });
}

module.exports = {
  startServer
};
