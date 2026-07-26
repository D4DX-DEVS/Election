const router = require("express").Router();
const { login, getCurrentUser, updateProfile, changePassword } = require("../controllers/auth");
const { protect } = require("../middleware/auth");
const { loginRateLimit } = require("../middleware/loginRateLimit");

router.post("/login", loginRateLimit, login);
// Self-service reset disabled: it only checked username+email match, letting
// anyone who knows/guesses a user's email take over the account. Re-enable
// once a token/OTP-verified flow (via lib/email.js) replaces it.
router.post("/forgot-password", (req, res) => {
  res.status(410).json({
    success: false,
    message: "Self-service password reset is disabled. Contact your administrator to reset your password.",
  });
});
router.get("/me", protect, getCurrentUser);
router.put("/me", protect, updateProfile);
router.post("/change-password", protect, changePassword);

module.exports = router;
