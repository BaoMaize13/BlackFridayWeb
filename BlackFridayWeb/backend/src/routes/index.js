const { Router } = require("express");

const adminRoutes = require("./admin.routes");
const healthRoutes = require("./health.routes");
const purchaseRoutes = require("./purchase.routes");

const router = Router();

router.use("/admin", adminRoutes);
router.use("/health", healthRoutes);
router.use("/purchase", purchaseRoutes);

module.exports = router;
