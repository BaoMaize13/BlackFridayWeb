const { Router } = require("express");

const activityController = require("../controllers/activity.controller");
const purchaseController = require("../controllers/purchase.controller");

const router = Router();

router.get("/history", activityController.getPurchaseHistory);
router.post("/no-lock", purchaseController.purchaseWithoutLock);
router.post("/with-lock", purchaseController.purchaseWithLock);
router.post("/optimistic-lock", purchaseController.purchaseOptimisticLock);

module.exports = router;
