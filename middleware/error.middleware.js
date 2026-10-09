function errorMiddleware(err, req, res, next) {
  console.error("\nBACKEND ERROR:");
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Logo file is too large. Maximum size is 5MB.",
    });
  }

  return res.status(500).json({
    success: false,
    message:
      err.message || "Internal server error.",
  });
}

module.exports = errorMiddleware;