const { Router } = require("express");

const adminRoutes = require("./admin.routes");
const authRoutes = require("./auth.routes");
const healthRoutes = require("./health.routes");
const purchaseRoutes = require("./purchase.routes");

const router = Router();
const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/health", healthRoutes);
apiRouter.use("/purchase", purchaseRoutes);

router.use("/api", apiRouter);
router.use("/health", healthRoutes);

module.exports = router;
