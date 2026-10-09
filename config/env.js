require("dotenv").config();

const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../..");

const env = {
  PORT: Number(process.env.PORT || 5000),

  FRONTEND_URL:
    process.env.FRONTEND_URL || "https://webtoapp-apk.vercel.app",

  BUILD_ENGINE_ROOT:
    process.env.BUILD_ENGINE_ROOT ||
    path.resolve(ROOT_DIR, "../build-engine"),

  MAX_FILE_SIZE:
    Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
};

module.exports = env;