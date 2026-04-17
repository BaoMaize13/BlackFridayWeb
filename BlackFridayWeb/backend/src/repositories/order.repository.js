const { ORDER_STATUSES } = require("../constants/domain");
const { getQueryExecutor } = require("../database/client");
const { ORDER_TABLE, mapOrderRecord } = require("../models/order.model");

class OrderRepository {
  async create(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const [insertedId] = await executor(ORDER_TABLE).insert({
      product_id: payload.productId,
      buyer_ref: payload.buyerRef,
      quantity: payload.quantity,
      status: payload.status,
      request_id: payload.requestId,
      failure_reason: payload.failureReason ?? null,
      created_at: executor.fn.now(),
      updated_at: executor.fn.now()
    });

    return this.findById(typeof insertedId === "object" ? insertedId.id : insertedId, options);
  }

  async findById(id, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(ORDER_TABLE).where({ id }).first();
    return mapOrderRecord(row);
  }

  async findByRequestId(requestId, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(ORDER_TABLE).where({ request_id: requestId }).first();
    return mapOrderRecord(row);
  }

  async list(options = {}) {
    const executor = getQueryExecutor(options.executor);
    const rows = await executor(ORDER_TABLE).select("*").orderBy("id", "desc");
    return rows.map(mapOrderRecord);
  }

  async countSuccessByProduct(productId, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(ORDER_TABLE)
      .where({
        product_id: productId,
        status: ORDER_STATUSES.SUCCESS
      })
      .count({ total: "*" })
      .first();

    return Number(row?.total ?? 0);
  }

  async deleteAll(options = {}) {
    const executor = getQueryExecutor(options.executor);
    return executor(ORDER_TABLE).del();
  }
}

module.exports = OrderRepository;
