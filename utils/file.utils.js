const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

function removeFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("File remove error:", error.message);
  }
}

function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

module.exports = {
  ensureDir,
  removeFile,
  getFileExtension,
};