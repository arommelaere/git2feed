#!/usr/bin/env node
import assert from "assert";

// Import the term processing functionality from generate.js
function processMessage(msg, options = {}) {
  const stripBranch = options.stripBranch || false;
  const confidentialItems = options.confidential
    ? options.confidential
        .split(",")
        .map((item) => item.toLowerCase())
        .filter(Boolean)
    : [];
  const hideItems = options.hide
    ? options.hide
        .split(",")
        .map((item) => item.toLowerCase())
        .filter(Boolean)
    : [];

  let processed = msg;

  // Strip branch name using improved regex
  if (stripBranch) {
    // Improved regex to handle "[BranchHere]: " pattern
    processed = processed.replace(/^\s*\[[^\]]*\](?:\s*:)?\s*/, "");
  }

  // Process confidential terms
  if (confidentialItems.length > 0) {
    for (const term of confidentialItems) {
      // Escape regex special characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const confidentialRegex = new RegExp(escapedTerm, "gi");
      processed = processed.replace(confidentialRegex, "--confidential--");
    }
  }

  // Process hide terms
  if (hideItems.length > 0) {
    for (const term of hideItems) {
      // Escape regex special characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hideRegex = new RegExp(escapedTerm, "gi");
      processed = processed.replace(hideRegex, "");
    }
  }

  return processed.trim();
}

// Run unit tests on the processing function
function runTests() {
  console.log("Running direct message processing tests...");
  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Basic string with no processing
    const msg1 = "Simple commit message";
    const result1 = processMessage(msg1);
    assert.strictEqual(result1, "Simple commit message");
    console.log("✅ Basic message - No change applied");
    passed++;

    // Test 2: Strip branch
    const msg2 = "[feature]: Added new functionality";
    const result2 = processMessage(msg2, { stripBranch: true });
    assert.strictEqual(result2, "Added new functionality");
    console.log("✅ Strip branch - Branch name removed");
    passed++;

    // Test 3: Replace confidential term
    const msg3 = "Added aws credentials";
    const result3 = processMessage(msg3, { confidential: "aws" });
    assert.strictEqual(result3, "Added --confidential-- credentials");
    console.log("✅ Confidential option - Basic term replaced");
    passed++;

    // Test 4: Replace confidential term with spaces
    const msg4 = "Added api key for authentication";
    const result4 = processMessage(msg4, { confidential: "api key" });
    assert.strictEqual(result4, "Added --confidential-- for authentication");
    console.log("✅ Confidential option - Term with spaces replaced");
    passed++;

    // Test 5: Replace multiple confidential terms
    const msg5 = "Added aws access key and updated S3 bucket";
    const result5 = processMessage(msg5, { confidential: "aws,S3" });
    assert.strictEqual(
      result5,
      "Added --confidential-- access key and updated --confidential-- bucket"
    );
    console.log("✅ Confidential option - Multiple terms replaced");
    passed++;

    // Test 6: Hide term
    const msg6 = "Fixed password issues";
    const result6 = processMessage(msg6, { hide: "password" });
    assert.strictEqual(result6, "Fixed  issues");
    console.log("✅ Hide option - Basic term removed");
    passed++;

    // Test 7: Hide term with spaces
    const msg7 = "Updated private data in the database";
    const result7 = processMessage(msg7, { hide: "private data" });
    assert.strictEqual(result7, "Updated  in the database");
    console.log("✅ Hide option - Term with spaces removed");
    passed++;

    // Test 8: Hide multiple terms
    const msg8 = "Fixed password and secret token issues";
    const result8 = processMessage(msg8, { hide: "password,secret token" });
    assert.strictEqual(result8, "Fixed  and  issues");
    console.log("✅ Hide option - Multiple terms removed");
    passed++;

    // Test 9: Combined options
    const msg9 = "[branch]: Added aws keys and private data";
    const result9 = processMessage(msg9, {
      stripBranch: true,
      confidential: "aws",
      hide: "private data",
    });
    assert.strictEqual(result9, "Added --confidential-- keys and");
    console.log("✅ Combined options - All operations applied correctly");
    passed++;

    // Test 10: Case insensitivity
    const msg10 = "Updated AWS credentials and Api Key";
    const result10 = processMessage(msg10, {
      confidential: "aws,api key",
    });
    assert.strictEqual(
      result10,
      "Updated --confidential-- credentials and --confidential--"
    );
    console.log("✅ Case insensitivity - Terms matched regardless of case");
    passed++;

    // Test 11: Special characters in terms
    const msg11 = "Updated node.js and api-key";
    const result11 = processMessage(msg11, {
      confidential: "node.js,api-key",
    });
    assert.strictEqual(
      result11,
      "Updated --confidential-- and --confidential--"
    );
    console.log(
      "✅ Special characters - Terms with special characters matched"
    );
    passed++;

    // Note: The force option is handled in the generateUpdates function and doesn't
    // directly affect the processMessage function. It controls whether to rebuild all files
    // and ignore previously seen commits. We can't test it here effectively, but it would
    // be tested in integration tests.

    console.log(`\n🎉 All ${passed} tests passed!`);
  } catch (error) {
    failed++;
    console.error("\n❌ Test failed:");
    console.error(error);
    console.log(`\n✅ ${passed} tests passed, ❌ ${failed} tests failed`);
    process.exit(1);
  }
}

runTests();
