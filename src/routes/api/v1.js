/* v1 routes: user authentication and password management endpoints. */
const router = require("express").Router();
const { userTokenAuth } = require("../../middlewares/user");

const {
  signUp,
  verifyOTP,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  refreshToken,
  checkAvailability,
} = require("../../controllers/app/authController");

router.post("/verify-otp", verifyOTP);
router.post("/sign-up", signUp);
router.post("/check-availability", checkAvailability);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", userTokenAuth, changePassword);
router.post("/refresh-token", refreshToken);
router.post("/logout", userTokenAuth, logout);

module.exports = router;
