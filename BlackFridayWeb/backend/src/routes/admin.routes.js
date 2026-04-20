const { Router } = require("express");

const { AUTH_ROLES } = require("../constants/auth.constants");
const attemptLogController = require("../controllers/admin-attempt-log.controller");
const metricsController = require("../controllers/admin-metrics.controller");
const orderController = require("../controllers/admin-order.controller");
const productController = require("../controllers/admin-product.controller");
const statsController = require("../controllers/admin-stats.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = Router();

router.use(authenticateToken);
router.use(requireRole(AUTH_ROLES.ADMIN));

router.route("/products").post(productController.createProduct).get(productController.listProducts);
router.get("/products/:productId", productController.getProductById);
router.patch("/products/:productId/stock", productController.updateProductStock);
router.post("/products/:productId/reset", productController.resetProductData);

router.route("/orders").get(orderController.listOrders).delete(orderController.deleteOrders);
router.get("/orders/:orderId", orderController.getOrderById);

router.route("/attempt-logs").get(attemptLogController.listAttemptLogs).delete(attemptLogController.deleteAttemptLogs);
router.get("/attempt-logs/:requestId", attemptLogController.getAttemptLogsByRequestId);

router.get("/metrics", metricsController.getAdminMetrics);
router.get("/stats", statsController.getAdminStats);

module.exports = router;
