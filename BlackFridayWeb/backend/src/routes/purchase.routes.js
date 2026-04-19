const { Router } = require("express");

const purchaseController = require("../controllers/purchase.controller");

const router = Router();

router.post("/no-lock", purchaseController.purchaseWithoutLock);
router.post("/with-lock", purchaseController.purchaseWithLock);

module.exports = router;
