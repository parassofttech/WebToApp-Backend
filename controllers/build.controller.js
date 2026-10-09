const path = require("path");
const fs = require("fs");

const {
  getBuildJob,
  getAllBuilds,
} = require("../services/build.service");

async function getBuild(req, res) {
  const { id } = req.params;

  const job = getBuildJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Build not found.",
    });
  }

  return res.json({
    success: true,

    data: {
      id: job.id,

      status: job.status,

      progress: job.progress,

      message: job.message,

      appName: job.appName,

      websiteUrl: job.websiteUrl,

      apk: job.apk
        ? `/api/builds/${job.id}/download/apk`
        : null,

      aab: job.aab
        ? `/api/builds/${job.id}/download/aab`
        : null,

      error: job.error,

      createdAt: job.createdAt,

      startedAt: job.startedAt,

      completedAt: job.completedAt,
    },
  });
}

async function downloadBuild(req, res) {
  const { id, type } = req.params;

  const job = getBuildJob(id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Build not found.",
    });
  }

  if (job.status !== "completed") {
    return res.status(409).json({
      success: false,
      message: "Build is not completed yet.",
    });
  }

  let filePath;

  if (type === "apk") {
    filePath = job.apk;
  } else if (type === "aab") {
    filePath = job.aab;
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid build type.",
    });
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "Build file not found.",
    });
  }

  const filename = path.basename(filePath);

  res.download(filePath, filename);
}

async function listBuilds(req, res) {
  const builds = getAllBuilds();

  return res.json({
    success: true,
    count: builds.length,
    data: builds.map((job) => ({
      id: job.id,
      appName: job.appName,
      websiteUrl: job.websiteUrl,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })),
  });
}

module.exports = {
  getBuild,
  downloadBuild,
  listBuilds,
};