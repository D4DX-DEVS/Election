const router = require("express").Router();
const { getSystemHealth } = require("../controllers/system");
const { protect, authorize } = require("../middleware/auth");

router.get("/health", protect, authorize("super_admin"), getSystemHealth);

module.exports = router;
