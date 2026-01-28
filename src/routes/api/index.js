/* API router: exposes versioned routers (v1, v2, ...). */
const router = require("express").Router();
const v1 = require("./v1");

// Current stable API version
router.use("/v1", v1);

module.exports = router;
