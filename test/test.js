#!/usr/bin/env node
import { generateUpdates } from "../src/generate.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Create a test output directory
const testDir = path.join(root, "test", "temp-output");
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Helper function to clean up test files
function cleanup() {
  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testDir, file));
    }
  }
}

// Setup test data
function setup() {
  // Create a simple updates.txt file for testing
  const updatesContent = `2025-01-01
- Added aws credentials
- Updated the S3 bucket
- Added api key for authentication
- Updated secret token for access
- Added private data to database
- Updated internal code and documentation

2024-12-31
- [feature]: Added new UI components
- [fix]: Fixed critical bug with aws
- Normal content line
`;

  fs.writeFileSync(path.join(testDir, "updates.txt"), updatesContent);

  // Create an empty index file
  fs.writeFileSync(
    path.join(testDir, "updates.index.json"),
    JSON.stringify({ seen: [] }, null, 2)
  );
}

async function runTests() {
  console.log("Running git2feed tests...");

  try {
    cleanup();
    setup();

    // Test 1: Basic functionality - verify our setup works
    console.log("1. Testing basic functionality...");
    const basicResult = await generateUpdates({
      outDir: testDir,
    });

    assert(fs.existsSync(basicResult.txtPath), "Text file should exist");
    assert(fs.existsSync(basicResult.jsonPath), "JSON file should exist");
    assert(fs.existsSync(basicResult.rssPath), "RSS file should exist");
    console.log("✅ Basic functionality - Files generated successfully");

    // Test 2: Confidential option (basic terms)
    console.log("2. Testing confidential option with basic terms...");
    cleanup();
    setup();

    const confidentialResult = await generateUpdates({
      outDir: testDir,
      confidential: "aws,s3",
    });

    const confidentialContent = fs.readFileSync(
      confidentialResult.txtPath,
      "utf8"
    );
    console.log("---- Content with confidential replacements ----");
    console.log(confidentialContent);
    console.log("----------------------------------------------");

    assert(
      confidentialContent.includes("Added --confidential-- credentials"),
      "Basic confidential term 'aws' was not replaced"
    );
    assert(
      confidentialContent.includes("Updated the --confidential-- bucket"),
      "Basic confidential term 'S3' was not replaced"
    );
    assert(
      confidentialContent.includes("Fixed critical bug with --confidential--"),
      "Term 'aws' in branch content was not replaced"
    );

    console.log("✅ Confidential option (basic) - Terms correctly replaced");

    // Test 3: Confidential option (terms with spaces)
    console.log(
      "3. Testing confidential option with terms containing spaces..."
    );
    cleanup();
    setup();

    const spacesResult = await generateUpdates({
      outDir: testDir,
      confidential: "api key,secret token",
    });

    const spacesContent = fs.readFileSync(spacesResult.txtPath, "utf8");
    console.log("---- Content with space term replacements ----");
    console.log(spacesContent);
    console.log("-------------------------------------------");

    assert(
      spacesContent.includes("Added --confidential-- for authentication"),
      "Confidential term with space 'api key' was not replaced"
    );
    assert(
      spacesContent.includes("Updated --confidential-- for access"),
      "Confidential term with space 'secret token' was not replaced"
    );

    console.log(
      "✅ Confidential option (with spaces) - Terms with spaces correctly replaced"
    );

    // Test 4: Hide option (basic terms)
    console.log("4. Testing hide option with basic terms...");
    cleanup();
    setup();

    const hideResult = await generateUpdates({
      outDir: testDir,
      hide: "aws,s3",
    });

    const hideContent = fs.readFileSync(hideResult.txtPath, "utf8");
    console.log("---- Content with hidden terms ----");
    console.log(hideContent);
    console.log("---------------------------------");

    assert(
      hideContent.includes("Added  credentials"),
      "Basic hide term 'aws' was not removed"
    );
    assert(
      hideContent.includes("Updated the  bucket"),
      "Basic hide term 'S3' was not removed"
    );
    assert(
      hideContent.includes("Fixed critical bug with "),
      "Term 'aws' in branch content was not removed"
    );

    console.log("✅ Hide option (basic) - Terms correctly hidden");

    // Test 5: Hide option (terms with spaces)
    console.log("5. Testing hide option with terms containing spaces...");
    cleanup();
    setup();

    const hideSpacesResult = await generateUpdates({
      outDir: testDir,
      hide: "private data,internal code",
    });

    const hideSpacesContent = fs.readFileSync(hideSpacesResult.txtPath, "utf8");
    console.log("---- Content with hidden space terms ----");
    console.log(hideSpacesContent);
    console.log("--------------------------------------");

    assert(
      hideSpacesContent.includes("Added  to database"),
      "Hide term with space 'private data' was not removed"
    );
    assert(
      hideSpacesContent.includes("Updated  and documentation"),
      "Hide term with space 'internal code' was not removed"
    );

    console.log(
      "✅ Hide option (with spaces) - Terms with spaces correctly hidden"
    );

    // Test 6: Strip branch option
    console.log("6. Testing strip branch option...");
    cleanup();
    setup();

    const stripBranchResult = await generateUpdates({
      outDir: testDir,
      stripBranch: true,
    });

    const stripContent = fs.readFileSync(stripBranchResult.txtPath, "utf8");
    console.log("---- Content with stripped branches ----");
    console.log(stripContent);
    console.log("-------------------------------------");

    assert(
      !stripContent.includes("[feature]:"),
      "Branch name '[feature]:' was not stripped"
    );
    assert(
      !stripContent.includes("[fix]:"),
      "Branch name '[fix]:' was not stripped"
    );
    assert(
      stripContent.includes("Added new UI components"),
      "Content after branch was not preserved"
    );

    console.log("✅ Strip branch option - Branch names correctly stripped");

    // Test 7: Combined options
    console.log("7. Testing combined options...");
    cleanup();
    setup();

    const combinedResult = await generateUpdates({
      outDir: testDir,
      stripBranch: true,
      confidential: "aws,api key",
      hide: "private data,s3",
    });

    const combinedContent = fs.readFileSync(combinedResult.txtPath, "utf8");
    console.log("---- Content with combined operations ----");
    console.log(combinedContent);
    console.log("---------------------------------------");

    assert(
      !combinedContent.includes("[feature]:"),
      "Branch name was not stripped in combined test"
    );
    assert(
      combinedContent.includes("Added --confidential-- credentials"),
      "Term 'aws' was not replaced in combined test"
    );
    assert(
      combinedContent.includes("Updated the  bucket"),
      "Term 'S3' was not hidden in combined test"
    );
    assert(
      combinedContent.includes("Added --confidential-- for authentication"),
      "Term with space 'api key' was not replaced in combined test"
    );
    assert(
      combinedContent.includes("Added  to database"),
      "Term with space 'private data' was not hidden in combined test"
    );

    console.log("✅ Combined options - All operations applied correctly");

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up at the end
    cleanup();
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  }
}

runTests();
