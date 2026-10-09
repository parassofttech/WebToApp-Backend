const express = require("express");

const upload = require("../middleware/upload.middleware");

const {
  analyze,
  createConversion,
} = require("../controllers/convert.controller");

const router = express.Router();

router.post(
  "/analyze",
  analyze
);

router.post(
  "/create",
  upload.single("logo"),
  createConversion
);

module.exports = router;