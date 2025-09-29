import fs from "fs";
import path from "path";

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function detectOutDir(root) {
  const pkg = readJSON(path.join(root, "package.json")) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (name) =>
    deps && Object.prototype.hasOwnProperty.call(deps, name);

  const exists = (dir) => fs.existsSync(path.join(root, dir));
  const pickExisting = (...dirs) => dirs.find(exists);

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

  return "public";
}
