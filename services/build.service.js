const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const env = require("../config/env");
const { ensureDir } = require("../utils/file.utils");

const jobs = new Map();

/**
 * Create a new build job
 */
function createBuildJob({
  buildId,
  websiteUrl,
  appName,
  logoPath,
}) {
  const job = {
    id: buildId,

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
  };

  jobs.set(buildId, job);

  startBuild(job, logoPath).catch((error) => {
    console.error("\n========================================");
    console.error("BUILD JOB FAILED");
    console.error("========================================");
    console.error(error);

    job.status = "failed";
    job.error = error.message || "Unknown build error";
    job.message = "Build failed";
    job.completedAt = new Date().toISOString();
  });

  return job;
}

/**
 * Start Build Engine
 */
async function startBuild(job, logoPath) {
  job.status = "building";
  job.progress = 5;
  job.message = "Starting Android build";
  job.startedAt = new Date().toISOString();

  const buildEngineRoot = path.resolve(
    env.BUILD_ENGINE_ROOT
  );

  ensureDir(buildEngineRoot);

  const outputDir = path.join(
    buildEngineRoot,
    "output"
  );

  ensureDir(outputDir);

  /*
   * IMPORTANT
   * On Windows use npm.cmd instead of npm.
   */
  const npmCommand =
    process.platform === "win32"
      ? "npm.cmd"
      : "npm";

  /*
   * Make sure logo path is absolute.
   */
  const absoluteLogoPath = logoPath
    ? path.resolve(logoPath)
    : path.join(
        buildEngineRoot,
        "input",
        "logo.png"
      );

  console.log("\n========================================");
  console.log(" STARTING BUILD ENGINE");
  console.log("========================================");
  console.log("Build ID :", job.id);
  console.log("Website  :", job.websiteUrl);
  console.log("App Name :", job.appName);
  console.log("Logo     :", absoluteLogoPath);
  console.log("Engine   :", buildEngineRoot);
  console.log("========================================\n");

  /*
   * Check logo
   */
  if (!fs.existsSync(absoluteLogoPath)) {
    throw new Error(
      `Logo file not found: ${absoluteLogoPath}`
    );
  }

  /*
   * Build Engine arguments
   */
  const args = [
    "run",
    "build",
    "--",
    "--url",
    job.websiteUrl,
    "--name",
    job.appName,
    "--logo",
    absoluteLogoPath,
  ];

  /*
   * Run Build Engine
   */
  await runCommand(
    npmCommand,
    args,
    buildEngineRoot,
    job
  );

  /*
   * Generate slug exactly like Build Engine
   */
  const slug = String(job.appName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  /*
   * Expected output files
   */
  const apkPath = path.join(
    outputDir,
    `${slug}-debug.apk`
  );

  const aabPath = path.join(
    outputDir,
    `${slug}.aab`
  );

  console.log("\n========================================");
  console.log(" CHECKING BUILD OUTPUT");
  console.log("========================================");
  console.log("APK:", apkPath);
  console.log("AAB:", aabPath);

  /*
   * APK check
   */
  if (!fs.existsSync(apkPath)) {
    console.error("APK NOT FOUND");

    /*
     * Try to find APK automatically.
     */
    const foundApk = findFile(
      outputDir,
      ".apk",
      slug
    );

    if (foundApk) {
      job.apk = foundApk;
    } else {
      throw new Error(
        `APK build completed but APK file was not found.\nExpected: ${apkPath}`
      );
    }
  } else {
    job.apk = apkPath;
  }

  /*
   * AAB check
   */
  if (!fs.existsSync(aabPath)) {
    console.error("AAB NOT FOUND");

    /*
     * Try to find AAB automatically.
     */
    const foundAab = findFile(
      outputDir,
      ".aab",
      slug
    );

    if (foundAab) {
      job.aab = foundAab;
    } else {
      throw new Error(
        `AAB build completed but AAB file was not found.\nExpected: ${aabPath}`
      );
    }
  } else {
    job.aab = aabPath;
  }

  console.log("\nAPK:", job.apk);
  console.log("AAB:", job.aab);

  /*
   * Build completed
   */
  job.status = "completed";
  job.progress = 100;
  job.message = "Build completed successfully";
  job.completedAt = new Date().toISOString();

  console.log("\n========================================");
  console.log(" BUILD JOB COMPLETED");
  console.log("========================================\n");
}

/**
 * Execute command
 */
function runCommand(command, args, cwd, job) {
  return new Promise((resolve, reject) => {
    console.log("\n========================================");
    console.log(" RUNNING BUILD ENGINE");
    console.log("========================================");

    console.log(
      `${command} ${args
        .map((arg) =>
          arg.includes(" ")
            ? `"${arg}"`
            : arg
        )
        .join(" ")}`
    );

    console.log("CWD:", cwd);

    const childEnv = {
      ...process.env,

      JAVA_HOME:
        process.env.JAVA_HOME ||
        "C:\\Program Files\\Java\\jdk-24",

      ANDROID_SDK_ROOT:
        process.env.ANDROID_SDK_ROOT ||
        "C:\\Users\\ACER\\AppData\\Local\\Android\\Sdk",

      ANDROID_HOME:
        process.env.ANDROID_HOME ||
        "C:\\Users\\ACER\\AppData\\Local\\Android\\Sdk",
    };

    /*
     * Windows par npm.cmd use karo
     */
    const executable =
      process.platform === "win32"
        ? "npm.cmd"
        : "npm";

    const child = spawn(
      executable,
      args,
      {
        cwd,
        shell: true,
        windowsHide: true,
        env: childEnv,
      }
    );

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();

      output += text;

      process.stdout.write(text);

      updateProgress(job, text);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();

      errorOutput += text;
      output += text;

      process.stderr.write(text);

      updateProgress(job, text);
    });

    child.on("error", (error) => {
      console.error(
        "\nSpawn Error:",
        error
      );

      reject(
        new Error(
          `Build Engine could not start: ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      console.log(
        `\nBuild Engine exited with code ${code}`
      );

      if (code === 0) {
        resolve(output);
        return;
      }

      const combinedOutput =
        `${output}\n${errorOutput}`.trim();

      const lastOutput =
        combinedOutput.length > 5000
          ? combinedOutput.slice(-5000)
          : combinedOutput;

      reject(
        new Error(
          `Build process exited with code ${code}\n\n${lastOutput}`
        )
      );
    });
  });
}

/**
 * Update job progress based on Build Engine output
 */
function updateProgress(job, output) {
  const text = String(output)
    .toLowerCase();

  if (text.includes("[1/6]")) {
    job.progress = 10;
    job.message =
      "Creating Android project";
  }

  if (text.includes("[2/6]")) {
    job.progress = 25;
    job.message =
      "Configuring Android app";
  }

  if (text.includes("[3/6]")) {
    job.progress = 40;
    job.message =
      "Generating app icon";
  }

  if (text.includes("[4/6]")) {
    job.progress = 55;
    job.message =
      "Building APK";
  }

  if (text.includes("[5/6]")) {
    job.progress = 80;
    job.message =
      "Building AAB";
  }

  if (text.includes("[6/6]")) {
    job.progress = 95;
    job.message =
      "Finalizing build";
  }

  if (
    text.includes("apk build success")
  ) {
    job.progress = 70;
    job.message = "APK generated";
  }

  if (
    text.includes("aab build success")
  ) {
    job.progress = 95;
    job.message = "AAB generated";
  }

  if (
    text.includes("build successful")
  ) {
    if (job.progress < 95) {
      job.progress = 90;
    }
  }
}

/**
 * Find generated APK/AAB automatically
 */
function findFile(
  directory,
  extension,
  slug
) {
  if (!fs.existsSync(directory)) {
    return null;
  }

  const files = fs.readdirSync(
    directory,
    {
      withFileTypes: true,
    }
  );

  /*
   * First look for exact slug match
   */
  for (const file of files) {
    if (!file.isFile()) {
      continue;
    }

    const name =
      file.name.toLowerCase();

    if (
      name.endsWith(extension) &&
      name.includes(slug)
    ) {
      return path.join(
        directory,
        file.name
      );
    }
  }

  /*
   * Then fallback to any matching extension
   */
  for (const file of files) {
    if (!file.isFile()) {
      continue;
    }

    const name =
      file.name.toLowerCase();

    if (
      name.endsWith(extension)
    ) {
      return path.join(
        directory,
        file.name
      );
    }
  }

  return null;
}

/**
 * Get one build
 */
function getBuildJob(buildId) {
  return jobs.get(buildId) || null;
}

/**
 * Get all builds
 */
function getAllBuilds() {
  return Array.from(
    jobs.values()
  ).sort(
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