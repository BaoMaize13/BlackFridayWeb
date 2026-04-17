const { getQueryExecutor } = require("../database/client");
const { PURCHASE_LOG_TABLE, mapPurchaseLogRecord } = require("../models/purchase_log.model");

class PurchaseLogRepository {
  async create(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const [insertedId] = await executor(PURCHASE_LOG_TABLE).insert({
      request_id: payload.requestId,
      server_id: payload.serverId,
      product_id: payload.productId,
      stock_before: payload.stockBefore ?? null,
      stock_after: payload.stockAfter ?? null,
      action: payload.action,
      result: payload.result,
      message: payload.message ?? null,
      created_at: executor.fn.now()
    });

    return this.findById(typeof insertedId === "object" ? insertedId.id : insertedId, options);
  }

  async findById(id, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(PURCHASE_LOG_TABLE).where({ id }).first();
    return mapPurchaseLogRecord(row);
  }

  async listByProduct(productId, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const rows = await executor(PURCHASE_LOG_TABLE).where({ product_id: productId }).orderBy("created_at", "desc");
    return rows.map(mapPurchaseLogRecord);
  }

  async listByRequestId(requestId, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const rows = await executor(PURCHASE_LOG_TABLE).where({ request_id: requestId }).orderBy("created_at", "asc");
    return rows.map(mapPurchaseLogRecord);
  }

  async deleteAll(options = {}) {
    const executor = getQueryExecutor(options.executor);
    return executor(PURCHASE_LOG_TABLE).del();
  }
}

module.exports = PurchaseLogRepository;
