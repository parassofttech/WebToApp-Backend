const crypto = require("crypto");

const {
  analyzeWebsite,
} = require("../services/website.service");

const {
  createBuildMetadata,
} = require("../services/appGenerator.service");

const {
  createBuildJob,
} = require("../services/build.service");

async function analyze(req, res, next) {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Website URL is required.",
      });
    }

    const result = await analyzeWebsite(url);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function createConversion(req, res, next) {
  try {
    const {
      url,
      appName,
      permission,
    } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Website URL is required.",
      });
    }

    if (!appName) {
      return res.status(400).json({
        success: false,
        message: "App name is required.",
      });
    }

    if (!permission) {
      return res.status(400).json({
        success: false,
        message:
          "You must confirm that you have permission to convert this website.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "App logo is required.",
      });
    }

    await analyzeWebsite(url);

    const buildId = crypto.randomUUID();

    const metadata = createBuildMetadata({
      buildId,
      websiteUrl: url,
      appName,
      logoPath: req.file.path,
    });

    const job = createBuildJob({
      buildId,
      websiteUrl: url,
      appName,
      logoPath: req.file.path,
    });

    return res.status(202).json({
      success: true,

      message: "Build started successfully.",

      data: {
        buildId,

        appName: metadata.appName,

        packageName: metadata.packageName,

        status: job.status,

        progress: job.progress,

        statusUrl: `/api/builds/${buildId}`,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyze,
  createConversion,
};