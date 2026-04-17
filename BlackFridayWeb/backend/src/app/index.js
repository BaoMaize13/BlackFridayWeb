const cors = require("cors");
const express = require("express");

const errorMiddleware = require("../middlewares/error.middleware");
const notFoundMiddleware = require("../middlewares/not-found.middleware");
const requestContextMiddleware = require("../middlewares/request-context.middleware");
const requestLogger = require("../middlewares/request-logger.middleware");
const routes = require("../routes");

function registerCoreMiddlewares(app) {
  app.disable("x-powered-by");
  app.use(requestContextMiddleware);
  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}

function registerRoutes(app) {
  app.use(routes);
}

function registerErrorHandling(app) {
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
}

function createApp() {
  const app = express();

  registerCoreMiddlewares(app);
  registerRoutes(app);
  registerErrorHandling(app);

  return app;
}

module.exports = {
  createApp
};
