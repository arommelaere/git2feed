#!/usr/bin/env node

/**
 * git2feed CLI - Generate updates.txt, JSON and RSS from git commits
 *
 * @author Aurélien Rommelaere <https://arommelaere.com>
 * @license MIT
 */

import { generateUpdates } from "./generate.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Check if first argument is a command
const command =
  process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : null;

// Handle 'install' command
if (command === "install") {
  try {
    // Exécuter le script d'installation des hooks
    const installScript = path.join(__dirname, "install-hooks.js");

    console.log("🔄 Installation des hooks git...");

    // Exécuter le script install-hooks.js
    execSync(`node "${installScript}"`, { stdio: "inherit" });

    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de l'installation des hooks:", error.message);
    process.exit(1);
  }
}

// Handle 'install-endpoint' command
if (command === "install-endpoint") {
  try {
    // Exécuter le script d'installation des endpoints
    const setupScript = path.join(__dirname, "setup-endpoints.js");

    console.log("🔄 Installation des endpoints dynamiques...");

    // Exécuter le script setup-endpoints.js
    execSync(`node "${setupScript}"`, { stdio: "inherit" });

    process.exit(0);
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'installation des endpoints:",
      error.message
    );
    process.exit(1);
  }
}

const root = arg("--root") || process.cwd();
const outDir = arg("--out") || null;
const siteUrl = arg("--site") || null;
const maxCount = arg("--max") ? parseInt(arg("--max"), 10) : null;
const since = arg("--since") || null;
const keep = arg("--keep") || null;
const stripBranch = hasFlag("--strip-branch");
const confidential = arg("--confidential") || null;
const hide = arg("--hide") || null;
const force = hasFlag("--force") || hasFlag("--f");

// Display help if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
git2feed - Generate updates.txt, JSON and RSS from git commits

Usage:
  git2feed [command] [options]

Commands:
  install             Install git hooks in the current repository
  install-endpoint    Install dynamic API endpoints for your framework (Next.js, Express, etc.)
  
Options:
  --root <path>          Repository root path (default: current directory)
  --out <path>           Output directory (auto-detected based on project type)
  --site <url>           Site URL for RSS feed (default: empty or from env)
  --max <num>            Maximum number of commits to process (default: 2000)
  --since <date>         Process commits since date (e.g. "1 week ago")
  --keep <regex>         Regex pattern for keeping commits (overrides default filter)
  --strip-branch         Remove branch names from commit messages (e.g. "[branch]: Message" → "Message")
  --confidential <list>  Replace confidential terms with "--confidential--" (comma-separated)
  --hide <list>          Completely hide specific terms (comma-separated)
  --force, --f           Force regeneration of all files, ignoring previously processed commits
  --help, -h             Show this help message

Created by Aurélien Rommelaere (https://arommelaere.com)
`);
  process.exit(0);
}

generateUpdates({
  root,
  outDir,
  siteUrl,
  maxCount,
  since,
  keep,
  stripBranch,
  confidential,
  hide,
  force,
})
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
// Test commit pour git2feed
