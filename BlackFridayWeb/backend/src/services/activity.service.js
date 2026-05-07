const { OrderRepository, PurchaseAttemptRepository } = require("../repositories");

const orderRepository = new OrderRepository();
const purchaseAttemptRepository = new PurchaseAttemptRepository();

class ActivityService {
  async getPurchaseHistory(filter = {}) {
    const [orders, logs] = await Promise.all([
      orderRepository.listOrders(filter),
      purchaseAttemptRepository.listAttemptLogs(filter)
    ]);

    return {
      logs,
      orders
    };
  }

  async listActivities(filter = {}) {
    const history = await this.getPurchaseHistory(filter);
    const orderActivities = history.orders.map((order) => ({
      id: `order-${order.id}`,
      type: "ORDER",
      requestId: order.requestId,
      productId: order.productId,
      status: order.status,
      reason: order.failureReason,
      quantity: order.quantity,
      timestamp: order.createdAt,
      data: order
    }));
    const logActivities = history.logs.map((log) => ({
      id: `log-${log.id}`,
      type: "LOG",
      requestId: log.requestId,
      productId: log.productId,
      status: log.result,
      reason: log.action,
      quantity: null,
      timestamp: log.createdAt,
      data: log
    }));

    return [...orderActivities, ...logActivities].sort(
      (left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)
    );
  }
}

module.exports = new ActivityService();
