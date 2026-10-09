function generatePackageName(appName) {
  let clean = String(appName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  clean = clean.slice(0, 30);

  if (!clean) {
    clean = `app${Date.now()}`;
  }

  return `com.webtoapp.${clean}`;
}

function slugifyAppName(appName) {
  return String(appName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

module.exports = {
  generatePackageName,
  slugifyAppName,
};