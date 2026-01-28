/* Root router: mounts versioned API routes under /api. */
const router = require("express").Router();
const appRoute = require("./api/index");

// Versioned API namespace
router.use("/api", appRoute);

module.exports = router;
