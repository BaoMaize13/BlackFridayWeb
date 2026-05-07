const { Router } = require("express");

const lockController = require("../controllers/lock.controller");

const router = Router();

router.get("/status", lockController.getStatus);
router.get("/metrics", lockController.getMetrics);
router.post("/clear-expired", lockController.clearExpired);

module.exports = router;
