const { Router } = require("express");

const authController = require("../controllers/auth.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/logout", authenticateToken, authController.logout);
router.get("/me", authenticateToken, authController.getCurrentUser);
router.get("/validate", authenticateToken, authController.getCurrentUser);

module.exports = router;
