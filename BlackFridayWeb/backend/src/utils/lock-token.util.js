const { randomUUID } = require("node:crypto");

const { serverConfig } = require("../config");

function generateLockToken(options = {}) {
  const tokenSegments = [
    options.serverId || serverConfig.id,
    options.requestId || "no-request-id",
    randomUUID()
  ];

  return tokenSegments.join(":");
}

module.exports = {
  generateLockToken
};
