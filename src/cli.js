#!/usr/bin/env node

/**
 * git2feed CLI - Generate updates.txt, JSON and RSS from git commits
 *
 * @author Aurélien Rommelaere <https://arommelaere.com>
 * @license MIT
 */

import { generateUpdates } from "./generate.js";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("-")) return true;
  return v;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const root = arg("--root") || process.cwd();
const outDir = arg("--out") || null;
const siteUrl = arg("--site") || null;
const maxCount = arg("--max") ? parseInt(arg("--max"), 10) : null;
const since = arg("--since") || null;
const keep = arg("--keep") || null;
const stripBranch = hasFlag("--strip-branch");

// Display help if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
git2feed - Generate updates.txt, JSON and RSS from git commits

Usage:
  git2feed [options]

Options:
  --root <path>    Repository root path (default: current directory)
  --out <path>     Output directory (auto-detected based on project type)
  --site <url>     Site URL for RSS feed (default: empty or from env)
  --max <num>      Maximum number of commits to process (default: 2000)
  --since <date>   Process commits since date (e.g. "1 week ago")
  --keep <regex>   Regex pattern for keeping commits (overrides default filter)
  --strip-branch   Remove branch names from commit messages (e.g. "[branch]: Message" → "Message")
  --help, -h       Show this help message

Created by Aurélien Rommelaere (https://arommelaere.com)
`);
  process.exit(0);
}

generateUpdates({ root, outDir, siteUrl, maxCount, since, keep, stripBranch })
  .then(({ outDir, txtPath, jsonPath, rssPath }) => {
    console.log(`✅ Successfully generated updates files in ${outDir}:`);
    console.log(`   - ${txtPath}`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${rssPath}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(`❌ Error generating updates:`);
    console.error(e?.stack || e?.message || e);
    process.exit(1);
  });
