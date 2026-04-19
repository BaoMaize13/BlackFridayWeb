const adminOrderService = require("../services/admin-order.service");
const { sendSuccess } = require("../utils/response");
const {
  validateDeleteOrdersQuery,
  validateListOrdersQuery,
  validateOrderIdParam
} = require("../validators/admin.validator");

async function listOrders(req, res) {
  const filter = validateListOrdersQuery(req.query);
  const orders = await adminOrderService.listOrders(filter);

  return sendSuccess(res, req, {
    message: "Orders retrieved successfully",
    data: orders,
    meta: {
      totalItems: orders.length
    }
  });
}

async function getOrderById(req, res) {
  const orderId = validateOrderIdParam(req.params.orderId);
  const order = await adminOrderService.getOrderById(orderId);

  return sendSuccess(res, req, {
    message: "Order retrieved successfully",
    data: order
  });
}

async function deleteOrders(req, res) {
  const filter = validateDeleteOrdersQuery(req.query);
  const result = await adminOrderService.deleteOrders(filter, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "Orders deleted successfully",
    data: result
  });
}

module.exports = {
  deleteOrders,
  getOrderById,
  listOrders
};
