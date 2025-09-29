#!/usr/bin/env node
import { generateUpdates } from "../src/generate.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function runTests() {
  console.log("Running git2feed tests...");

  try {
    // Test basic functionality
    const result = await generateUpdates({
      root,
      maxCount: 50,
    });

    console.log("✅ Successfully generated update files:");
    console.log(`   - ${result.txtPath}`);
    console.log(`   - ${result.jsonPath}`);
    console.log(`   - ${result.rssPath}`);

    // Verify files exist
    const allFilesExist = [
      result.txtPath,
      result.jsonPath,
      result.rssPath,
      result.indexPath,
    ].every((file) => fs.existsSync(file));

    if (!allFilesExist) {
      throw new Error("Some output files are missing");
    }

    // Verify JSON file structure
    const jsonData = JSON.parse(fs.readFileSync(result.jsonPath, "utf8"));
    if (!jsonData.updated_at || !Array.isArray(jsonData.items)) {
      throw new Error("JSON file has incorrect structure");
    }

    // Clean up files for next test
    fs.unlinkSync(result.txtPath);
    fs.unlinkSync(result.jsonPath);
    fs.unlinkSync(result.rssPath);
    fs.unlinkSync(result.indexPath);

    // Test stripBranch option
    console.log("\nTesting stripBranch option...");
    const resultWithStripBranch = await generateUpdates({
      root,
      maxCount: 50,
      stripBranch: true,
    });

    // Read the first line of updates.txt to check if it contains branch names
    const txtContent = fs.readFileSync(resultWithStripBranch.txtPath, "utf8");
    const contentLines = txtContent
      .split("\n")
      .filter((line) => line.startsWith("-"));

    // Check if any line contains branch pattern [branch]:
    const hasBranchPattern = contentLines.some((line) =>
      /\[[^\]]*\]\s*:/.test(line)
    );

    if (hasBranchPattern) {
      throw new Error("Branch names were not stripped correctly");
    } else {
      console.log("✅ Branch names stripped correctly");
    }

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests();
