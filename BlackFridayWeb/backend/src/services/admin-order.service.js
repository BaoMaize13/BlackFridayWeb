const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { OrderRepository } = require("../repositories");
const AppError = require("../utils/app-error");

const orderRepository = new OrderRepository();

function createOrderNotFoundError(orderId) {
  return new AppError({
    message: `Order with id ${orderId} was not found`,
    statusCode: HTTP_STATUS.NOT_FOUND,
    errorCode: ERROR_CODES.ORDER_NOT_FOUND
  });
}

class AdminOrderService {
  async listOrders(filter = {}) {
    return orderRepository.listOrders(filter);
  }

  async getOrderById(orderId) {
    const order = await orderRepository.findOrderById(orderId);

    if (!order) {
      throw createOrderNotFoundError(orderId);
    }

    return order;
  }

  async deleteOrders(filter = {}, options = {}) {
    let deletedCount = 0;
    let scope = "all";

    if (filter.productId) {
      deletedCount = await orderRepository.deleteOrdersByProduct(filter.productId);
      scope = "product";
    } else {
      if (!filter.confirm) {
        throw new AppError({
          message: "confirm=true is required to delete all orders",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errorCode: ERROR_CODES.CONFIRMATION_REQUIRED
        });
      }

      deletedCount = await orderRepository.deleteAllOrdersForTest();
    }

    options.logger?.info(
      {
        action: "admin.delete_orders",
        deletedCount,
        productId: filter.productId ?? null,
        scope
      },
      "Admin orders deleted"
    );

    return {
      deletedCount,
      productId: filter.productId ?? null,
      scope
    };
  }
}

module.exports = new AdminOrderService();
