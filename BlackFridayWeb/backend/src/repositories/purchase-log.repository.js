const { PURCHASE_LOG_TABLE, mapPurchaseLogRecord } = require("../models/purchase_log.model");
const { applyCreatedAtFilter, extractInsertedId, isProvided, resolveExecutor } = require("./repository.utils");

function applyAttemptLogFilters(query, filter = {}) {
  if (isProvided(filter.attemptLogId)) {
    query.where({ id: filter.attemptLogId });
  }

  if (isProvided(filter.productId)) {
    query.where({ product_id: filter.productId });
  }

  if (isProvided(filter.requestId)) {
    query.where({ request_id: filter.requestId });
  }

  if (isProvided(filter.serverId)) {
    query.where({ server_id: filter.serverId });
  }

  if (isProvided(filter.action)) {
    query.where({ action: filter.action });
  }

  if (isProvided(filter.result)) {
    query.where({ result: filter.result });
  }

  applyCreatedAtFilter(query, filter);
}

class PurchaseAttemptRepository {
  async createAttemptLog(data, options = {}) {
    const executor = resolveExecutor(options);
    const insertResult = await executor(PURCHASE_LOG_TABLE)
      .insert({
        request_id: data.requestId,
        server_id: data.serverId,
        product_id: data.productId ?? null,
        stock_before: data.stockBefore ?? null,
        stock_after: data.stockAfter ?? null,
        action: data.action,
        result: data.result,
        message: data.message ?? null,
        created_at: executor.fn.now()
      });

    const attemptLogId = extractInsertedId(insertResult);

    if (attemptLogId) {
      return this.findAttemptLogById(attemptLogId, options);
    }

    const matchingLogs = await this.listAttemptLogs(
      {
        action: data.action,
        productId: data.productId,
        requestId: data.requestId,
        result: data.result,
        serverId: data.serverId
      },
      options
    );

    return matchingLogs[0] ?? null;
  }

  async findAttemptLogById(attemptLogId, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(PURCHASE_LOG_TABLE).where({ id: attemptLogId }).first();
    return mapPurchaseLogRecord(row);
  }

  async listAttemptLogs(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PURCHASE_LOG_TABLE).select("*");

    applyAttemptLogFilters(query, filter);

    const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc");
    return rows.map(mapPurchaseLogRecord);
  }

  async countAttemptLogs(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PURCHASE_LOG_TABLE);

    applyAttemptLogFilters(query, filter);

    const row = await query.count({ total: "*" }).first();
    return Number(row?.total ?? 0);
  }

  async listAttemptLogsByProduct(productId, options = {}) {
    return this.listAttemptLogs({ productId }, options);
  }

  async listAttemptLogsByRequestId(requestId, options = {}) {
    const executor = resolveExecutor(options);
    const rows = await executor(PURCHASE_LOG_TABLE)
      .select("*")
      .where({ request_id: requestId })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");

    return rows.map(mapPurchaseLogRecord);
  }

  async deleteAttemptLogsByProduct(productId, options = {}) {
    const executor = resolveExecutor(options);
    return executor(PURCHASE_LOG_TABLE).where({ product_id: productId }).del();
  }

  async deleteAllAttemptLogsForTest(options = {}) {
    const executor = resolveExecutor(options);
    return executor(PURCHASE_LOG_TABLE).del();
  }
}

module.exports = PurchaseAttemptRepository;
