const { getQueryExecutor } = require("../database/client");

function isProvided(value) {
  return value !== undefined && value !== null;
}

function resolveExecutor(options = {}) {
  return getQueryExecutor(options.executor || options.transaction || options.tx || options.client);
}

function extractInsertedId(insertResult) {
  const [firstResult] = Array.isArray(insertResult) ? insertResult : [insertResult];

  if (!isProvided(firstResult)) {
    return null;
  }

  if (typeof firstResult === "object") {
    if (isProvided(firstResult.id)) {
      return firstResult.id;
    }

    const [firstValue] = Object.values(firstResult);
    return firstValue ?? null;
  }

  return firstResult;
}

function applyCreatedAtFilter(query, filter = {}, columnName = "created_at") {
  if (isProvided(filter.fromDate)) {
    query.where(columnName, ">=", filter.fromDate);
  }

  if (isProvided(filter.toDate)) {
    query.where(columnName, "<=", filter.toDate);
  }

  return query;
}

module.exports = {
  applyCreatedAtFilter,
  extractInsertedId,
  isProvided,
  resolveExecutor
};
