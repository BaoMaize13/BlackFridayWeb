const { databaseConfig } = require("./index");

function getDatabaseConfig() {
  return databaseConfig;
}

module.exports = {
  databaseConfig,
  getDatabaseConfig
};
