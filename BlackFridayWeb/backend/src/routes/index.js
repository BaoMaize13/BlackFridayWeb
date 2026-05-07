const { Router } = require("express");

const activityController = require("../controllers/activity.controller");
const adminRoutes = require("./admin.routes");
const authRoutes = require("./auth.routes");
const healthRoutes = require("./health.routes");
const lockRoutes = require("./lock.routes");
const productRoutes = require("./product.routes");
const purchaseRoutes = require("./purchase.routes");
const simulationRoutes = require("./simulation.routes");

const router = Router();
const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/health", healthRoutes);
apiRouter.use("/locks", lockRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/purchase", purchaseRoutes);
apiRouter.use("/simulation", simulationRoutes);
apiRouter.get("/activities", activityController.listActivities);

router.use("/api", apiRouter);
router.use("/health", healthRoutes);

module.exports = router;
