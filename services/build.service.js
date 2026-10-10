
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { ensureDir } = require("../utils/file.utils");

const jobs = new Map();

const BUILD_ENGINE_URL = (
  process.env.BUILD_ENGINE_URL || ""
).replace(/\/+$/, "");

const BUILD_ENGINE_API_KEY =
  process.env.BUILD_ENGINE_API_KEY || "";

const POLL_INTERVAL = 3000;

const OUTPUT_ROOT = path.resolve(
  __dirname,
  "..",
  "storage",
  "builds"
);

ensureDir(OUTPUT_ROOT);

function getHeaders() {
  return {
    "x-api-key": BUILD_ENGINE_API_KEY,
  };
}

function updateJob(job, updates) {
  Object.assign(job, updates);
}

function getErrorMessage(data, fallback) {
  return data?.error || data?.message || fallback;
}

async function readResponse(response) {
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        `Build Engine returned HTTP ${response.status}`
      )
    );
  }

  return data;
}

/**
 * Create a remote build job.
 * The frontend continues to use the backend build ID.
 */
function createBuildJob({
  buildId,
  websiteUrl,
  appName,
  logoPath,
}) {
  if (!BUILD_ENGINE_URL) {
    throw new Error(
      "BUILD_ENGINE_URL is missing from backend environment."
    );
  }

  if (!BUILD_ENGINE_API_KEY) {
    throw new Error(
      "BUILD_ENGINE_API_KEY is missing from backend environment."
    );
  }

  const id = buildId || crypto.randomUUID();

  const job = {
    id,
    buildId: id,

    websiteUrl,
    appName,

    status: "queued",
    progress: 0,
    message: "Build queued",

    apk: null,
    aab: null,

    error: null,

    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,

    engineBuildId: null,
    logs: "",
  };

  jobs.set(id, job);

  startBuild(job, logoPath).catch((error) => {
    console.error("REMOTE BUILD FAILED:", error);

    updateJob(job, {
      status: "failed",
      error: error.message || "Unknown build error",
      message: "Build failed",
      completedAt: new Date().toISOString(),
    });
  });

  return job;
}

/**
 * Submit the build request to the remote Build Engine.
 */
async function startBuild(job, logoPath) {
  updateJob(job, {
    status: "queued",
    progress: 2,
    message: "Connecting to Build Engine",
  });

  const form = new FormData();

  form.append("url", job.websiteUrl);
  form.append("appName", job.appName);

  if (logoPath) {
    const absoluteLogoPath = path.resolve(logoPath);

    await fs.promises.access(
      absoluteLogoPath,
      fs.constants.R_OK
    );

    const logoBuffer = await fs.promises.readFile(
      absoluteLogoPath
    );

    const extension = path.extname(
      absoluteLogoPath
    ).toLowerCase();

    const mimeTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };

    const mimeType = mimeTypes[extension];

    if (!mimeType) {
      throw new Error(
        "Logo must be PNG, JPG, JPEG, or WEBP."
      );
    }

    form.append(
      "logo",
      new Blob([logoBuffer], { type: mimeType }),
      path.basename(absoluteLogoPath)
    );
  }

  console.log("Submitting remote build:", {
    buildId: job.id,
    websiteUrl: job.websiteUrl,
    appName: job.appName,
    engineUrl: BUILD_ENGINE_URL,
    hasLogo: Boolean(logoPath),
  });

  console.log("[BUILD DEBUG] Starting remote build");
console.log("[BUILD DEBUG] Engine URL:", engineUrl);
console.log("[BUILD DEBUG] API key present:", Boolean(
  process.env.BUILD_ENGINE_API_KEY
));

  const response = await fetch(
    `${BUILD_ENGINE_URL}/api/builds`,
    {
      method: "POST",
      headers: getHeaders(),
      body: form,
      signal: AbortSignal.timeout(120000),
    }
  );

  const result = await readResponse(response);

  if (!result.buildId) {
    throw new Error(
      "Build Engine did not return a build ID."
    );
  }

  job.engineBuildId = result.buildId;

  updateJob(job, {
    status: result.status || "queued",
    progress: result.status === "building" ? 5 : 2,
    message: "Build request accepted",
    startedAt:
      result.status === "building"
        ? new Date().toISOString()
        : null,
  });

  await monitorBuild(job);
}

/**
 * Poll remote build status until completed or failed.
 */
async function monitorBuild(job) {
  while (
    job.status !== "completed" &&
    job.status !== "failed"
  ) {
    const response = await fetch(
      `${BUILD_ENGINE_URL}/api/builds/${encodeURIComponent(
        job.engineBuildId
      )}`,
      {
        method: "GET",
        headers: getHeaders(),
        signal: AbortSignal.timeout(30000),
      }
    );

    const result = await readResponse(response);

    job.logs = result.logs || job.logs;

    if (result.status === "queued") {
      updateJob(job, {
        status: "queued",
        progress: Math.max(job.progress, 2),
        message: "Waiting for build slot",
      });
    } else if (result.status === "building") {
      updateJob(job, {
        status: "building",
        progress: Math.max(
          job.progress,
          Math.min(result.progress || 5, 95)
        ),
        message: getBuildMessage(
          result.progress || 5
        ),
        startedAt:
          job.startedAt ||
          result.startedAt ||
          new Date().toISOString(),
      });
    } else if (result.status === "failed") {
      throw new Error(
        result.error ||
          "The remote Android build failed."
      );
    } else if (result.status === "completed") {
      updateJob(job, {
        status: "building",
        progress: 96,
        message: "Downloading generated APK and AAB",
      });

      await downloadArtifacts(job, result.files || []);

      updateJob(job, {
        status: "completed",
        progress: 100,
        message: "Build completed successfully",
        completedAt: new Date().toISOString(),
      });

      return;
    } else {
      throw new Error(
        `Unknown Build Engine status: ${result.status}`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, POLL_INTERVAL)
    );
  }
}

function getBuildMessage(progress) {
  if (progress < 15) return "Creating Android project";
  if (progress < 35) return "Configuring Android app";
  if (progress < 50) return "Generating app icon";
  if (progress < 75) return "Building APK";
  if (progress < 95) return "Building AAB";

  return "Finalizing build";
}

/**
 * Download the artifacts from Build Engine to backend storage.
 * Existing backend download routes can continue using local paths.
 */
async function downloadArtifacts(job, files) {
  const apkName = files.find(
    (file) => /\.apk$/i.test(file)
  );

  const aabName = files.find(
    (file) => /\.aab$/i.test(file)
  );

  if (!apkName && !aabName) {
    throw new Error(
      "Build completed, but no APK or AAB was returned."
    );
  }

  const jobOutputDir = path.join(
    OUTPUT_ROOT,
    job.id
  );

  await fs.promises.mkdir(jobOutputDir, {
    recursive: true,
  });

  if (apkName) {
    job.apk = await downloadArtifact(
      job.engineBuildId,
      apkName,
      jobOutputDir
    );
  }

  if (aabName) {
    job.aab = await downloadArtifact(
      job.engineBuildId,
      aabName,
      jobOutputDir
    );
  }

  if (!job.apk && !job.aab) {
    throw new Error(
      "Unable to download the generated build files."
    );
  }
}

async function downloadArtifact(
  engineBuildId,
  filename,
  outputDir
) {
  // Only permit APK/AAB filenames, never arbitrary paths.
  const safeFilename = path.basename(filename);

  if (
    safeFilename !== filename ||
    !/\.(apk|aab)$/i.test(safeFilename)
  ) {
    throw new Error("Invalid build artifact filename.");
  }

  const url =
    `${BUILD_ENGINE_URL}/api/builds/` +
    `${encodeURIComponent(engineBuildId)}/download/` +
    `${encodeURIComponent(safeFilename)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Could not download ${safeFilename}: ` +
      `${response.status} ${errorText}`
    );
  }

  const destination = path.join(
    outputDir,
    safeFilename
  );

  const temporaryPath = `${destination}.part`;

  try {
    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (buffer.length === 0) {
      throw new Error(
        `Downloaded artifact is empty: ${safeFilename}`
      );
    }

    await fs.promises.writeFile(
      temporaryPath,
      buffer
    );

    await fs.promises.rename(
      temporaryPath,
      destination
    );

    return destination;
  } catch (error) {
    await fs.promises
      .unlink(temporaryPath)
      .catch(() => {});

    throw error;
  }
}

/**
 * Get one build.
 */
function getBuildJob(buildId) {
  return jobs.get(buildId) || null;
}

/**
 * Get all builds.
 */
function getAllBuilds() {
  return Array.from(jobs.values()).sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
  );
}

module.exports = {
  createBuildJob,
  getBuildJob,
  getAllBuilds,
};
