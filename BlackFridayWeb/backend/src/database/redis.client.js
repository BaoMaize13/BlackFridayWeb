const { createClient } = require("redis");

const { redisConfig } = require("../config");
const { createLogger } = require("../utils/logger");

const redisLogger = createLogger({ module: "redis" });

const REDIS_CONNECT_TIMEOUT_MS = 1000;
const REDIS_MAX_RECONNECT_RETRIES = 3;

let redisClient = null;
let connectPromise = null;
let listenersRegistered = false;

const redisState = {
  configured: Boolean(redisConfig.url),
  connected: false,
  connecting: false,
  driver: redisConfig.driver,
  lastConnectedAt: null,
  lastError: null,
  ready: false
};

function buildRedisClient() {
  return createClient({
    url: redisConfig.url,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy(retries) {
        if (retries >= REDIS_MAX_RECONNECT_RETRIES) {
          return new Error("Redis reconnect retry limit reached");
        }

        return Math.min((retries + 1) * 50, 500);
      }
    }
  });
}

function registerClientListeners(client) {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  client.on("connect", () => {
    redisState.connected = true;
    redisState.lastError = null;

    redisLogger.info(
      {
        redis: {
          driver: redisConfig.driver
        }
      },
      "Redis socket connected"
    );
  });

  client.on("ready", () => {
    redisState.connected = true;
    redisState.ready = true;
    redisState.lastConnectedAt = new Date().toISOString();
    redisState.lastError = null;

    redisLogger.info("Redis client is ready");
  });

  client.on("reconnecting", () => {
    redisState.connected = false;
    redisState.ready = false;

    redisLogger.warn("Redis client reconnecting");
  });

  client.on("end", () => {
    redisState.connected = false;
    redisState.connecting = false;
    redisState.ready = false;

    redisLogger.info("Redis connection closed");
  });

  client.on("error", (error) => {
    redisState.connected = false;
    redisState.ready = false;
    redisState.lastError = error.message;

    redisLogger.error({ err: error }, "Redis client error");
  });
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = buildRedisClient();
    registerClientListeners(redisClient);
  }

  return redisClient;
}

async function connectRedis() {
  const client = getRedisClient();

  if (client.isOpen) {
    return client;
  }

  if (connectPromise) {
    return connectPromise;
  }

  redisState.connecting = true;

  connectPromise = client
    .connect()
    .then(() => {
      redisState.connecting = false;
      redisState.connected = true;
      redisState.ready = client.isReady;
      redisState.lastConnectedAt = new Date().toISOString();
      redisState.lastError = null;

      return client;
    })
    .catch((error) => {
      redisState.connecting = false;
      redisState.connected = false;
      redisState.ready = false;
      redisState.lastError = error.message;

      throw error;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

async function disconnectRedis() {
  if (!redisClient) {
    return;
  }

  try {
    if (connectPromise) {
      await connectPromise.catch(() => null);
    }

    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } finally {
    redisClient = null;
    connectPromise = null;
    listenersRegistered = false;
    redisState.connected = false;
    redisState.connecting = false;
    redisState.ready = false;
  }
}

function getRedisState() {
  const state = {
    configured: redisState.configured,
    connected: redisState.connected,
    connecting: redisState.connecting,
    driver: redisState.driver,
    ready: redisState.ready
  };

  if (redisState.lastConnectedAt) {
    state.lastConnectedAt = redisState.lastConnectedAt;
  }

  if (redisState.lastError) {
    state.lastError = redisState.lastError;
  }

  return state;
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  getRedisState
};
