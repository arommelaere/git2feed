#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const currentWorkDir = process.cwd();
const preCommitPath = path.join(currentWorkDir, ".git", "hooks", "pre-commit");

if (fs.existsSync(preCommitPath)) {
  const content = fs.readFileSync(preCommitPath, "utf-8");
  console.log("=== Contenu du hook pre-commit ===");
  console.log(content);
  console.log("=================================");
} else {
  console.log("Le hook pre-commit n'existe pas");
}
