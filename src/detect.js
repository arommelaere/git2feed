import fs from "fs";
import path from "path";

/**
 * Safely reads and parses a JSON file
 * @param {string} p - Path to the JSON file
 * @returns {object|null} Parsed JSON or null if file doesn't exist or is invalid
 */
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Detects the appropriate output directory based on the project type
 * @param {string} root - Root directory of the project
 * @returns {string} Detected output directory path
 */
export function detectOutDir(root) {
  // Read package.json to detect project type
  const pkg = readJSON(path.join(root, "package.json")) || {};
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const has = (name) =>
    deps && Object.prototype.hasOwnProperty.call(deps, name);

  const exists = (dir) => {
    try {
      return fs.existsSync(path.join(root, dir));
    } catch {
      return false;
    }
  };

  const pickExisting = (...dirs) => dirs.find(exists);

  // Framework-specific output directories
  if (has("next")) return pickExisting("public") || "public";
  if (has("remix") || has("@remix-run/node") || has("@remix-run/serve"))
    return pickExisting("public") || "public";
  if (has("astro")) return pickExisting("public") || "public";
  if (has("@sveltejs/kit")) return pickExisting("static", "public") || "static";
  if (has("nuxt") || has("nuxt3") || has("@nuxtjs/kit"))
    return pickExisting("public", "static") || "public";
  if (has("gatsby")) return pickExisting("static", "public") || "static";
  if (has("vitepress"))
    return pickExisting(".vitepress/public", "public") || ".vitepress/public";

  // Try common directories
  const common = pickExisting(
    "public",
    "static",
    "dist/public",
    "build/public",
    "www",
    "web",
    "htdocs",
    "site",
    "app/public"
  );

  if (common) return common;

  // Default to public
  return "public";
}
