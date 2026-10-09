const path = require("path");
const fs = require("fs");

const {
  generatePackageName,
  slugifyAppName,
} = require("../utils/packageName");

const env = require("../config/env");

function createBuildMetadata({
  buildId,
  websiteUrl,
  appName,
  logoPath,
}) {
  const packageName = generatePackageName(appName);

  const slug = slugifyAppName(appName);

  const buildDir = path.resolve(
    __dirname,
    "../../storage/builds",
    buildId
  );

  fs.mkdirSync(buildDir, {
    recursive: true,
  });

  const metadata = {
    buildId,
    websiteUrl,
    appName,
    packageName,
    slug,
    logoPath,
    buildEngineRoot: env.BUILD_ENGINE_ROOT,
    createdAt: new Date().toISOString(),
  };

  const metadataPath = path.join(
    buildDir,
    "metadata.json"
  );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(metadata, null, 2),
    "utf8"
  );

  return metadata;
}

module.exports = {
  createBuildMetadata,
};