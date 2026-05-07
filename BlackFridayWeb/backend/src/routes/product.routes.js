const { Router } = require("express");

const productController = require("../controllers/product.controller");

const router = Router();

router.get("/", productController.listProducts);
router.post("/reset-all", productController.resetAllProducts);
router.get("/:id", productController.getProductById);
router.post("/:id/reset-stock", productController.resetProductStock);

module.exports = router;
