#!/usr/bin/env node
import { generateUpdates } from "./generate.js";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("-")) return true;
  return v;
}

const root = arg("--root") || process.cwd();
const outDir = arg("--out") || null;
const siteUrl = arg("--site") || null;
const maxCount = arg("--max") || null;
const since = arg("--since") || null;
const keep = arg("--keep") || null;

generateUpdates({ root, outDir, siteUrl, maxCount, since, keep })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e?.stack || e?.message || e);
    process.exit(1);
  });
