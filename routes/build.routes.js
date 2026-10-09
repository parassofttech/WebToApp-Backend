const express = require("express");

const {
  getBuild,
  downloadBuild,
  listBuilds,
} = require("../controllers/build.controller");

const router = express.Router();

router.get(
  "/",
  listBuilds
);

router.get(
  "/:id",
  getBuild
);

router.get(
  "/:id/download/:type",
  downloadBuild
);

module.exports = router;