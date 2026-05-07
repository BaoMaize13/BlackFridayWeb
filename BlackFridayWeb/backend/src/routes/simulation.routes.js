const { Router } = require("express");

const simulationController = require("../controllers/simulation.controller");

const router = Router();

router.post("/no-lock", simulationController.runNoLockSimulation);
router.post("/with-lock", simulationController.runWithLockSimulation);
router.post("/compare", simulationController.runCompareSimulation);
router.get("/reports", simulationController.listReports);
router.get("/reports/:id", simulationController.getReport);

module.exports = router;
