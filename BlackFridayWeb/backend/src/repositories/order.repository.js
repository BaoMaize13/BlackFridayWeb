const { ORDER_STATUSES } = require("../constants/domain");
const { ORDER_TABLE, mapOrderRecord } = require("../models/order.model");
const { applyCreatedAtFilter, extractInsertedId, isProvided, resolveExecutor } = require("./repository.utils");

function applyOrderFilters(query, filter = {}) {
  if (isProvided(filter.orderId)) {
    query.where({ id: filter.orderId });
  }

  if (isProvided(filter.productId)) {
    query.where({ product_id: filter.productId });
  }

  if (isProvided(filter.status)) {
    query.where({ status: filter.status });
  }

  if (isProvided(filter.requestId)) {
    query.where({ request_id: filter.requestId });
  }

  applyCreatedAtFilter(query, filter);
}

class OrderRepository {
  async createOrder(data, options = {}) {
    const executor = resolveExecutor(options);
    const insertResult = await executor(ORDER_TABLE)
      .insert({
        product_id: data.productId,
        buyer_ref: data.buyerRef,
        quantity: data.quantity,
        status: data.status,
        request_id: data.requestId,
        failure_reason: data.failureReason ?? null,
        created_at: executor.fn.now(),
        updated_at: executor.fn.now()
      });

    const orderId = extractInsertedId(insertResult);

    if (orderId) {
      return this.findOrderById(orderId, options);
    }

    return this.findOrderByRequestId(data.requestId, options);
  }

  async findOrderById(orderId, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(ORDER_TABLE).where({ id: orderId }).first();
    return mapOrderRecord(row);
  }

  async findOrderByRequestId(requestId, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(ORDER_TABLE).where({ request_id: requestId }).first();
    return mapOrderRecord(row);
  }

  async listOrders(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(ORDER_TABLE).select("*");

    applyOrderFilters(query, filter);

    const rows = await query.orderBy("id", "desc");
    return rows.map(mapOrderRecord);
  }

  async countOrders(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(ORDER_TABLE);

    applyOrderFilters(query, filter);

    const row = await query
      .count({ total: "*" })
      .first();

    return Number(row?.total ?? 0);
  }

  async countSuccessOrdersByProduct(productId, options = {}) {
    return this.countOrders(
      {
        productId,
        status: ORDER_STATUSES.SUCCESS
      },
      options
    );
  }

  async sumOrderQuantity(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(ORDER_TABLE);

    applyOrderFilters(query, filter);

    const row = await query.sum({ totalQuantity: "quantity" }).first();
    return Number(row?.totalQuantity ?? 0);
  }

  async sumSuccessfulOrderQuantityByProduct(productId, options = {}) {
    return this.sumOrderQuantity(
      {
        productId,
        status: ORDER_STATUSES.SUCCESS
      },
      options
    );
  }

  async deleteOrdersByProduct(productId, options = {}) {
    const executor = resolveExecutor(options);
    return executor(ORDER_TABLE).where({ product_id: productId }).del();
  }

  async deleteAllOrdersForTest(options = {}) {
    const executor = resolveExecutor(options);
    return executor(ORDER_TABLE).del();
  }
}

module.exports = OrderRepository;
