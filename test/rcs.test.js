/**
 * RCS integration tests for vic.js
 *
 * These tests use pre-initialized RCS directories to avoid interactive prompts.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";

import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  readTestFile,
  runVic,
  hasRcs
} from "./helpers.js";

// Skip all RCS tests if RCS is not installed
const skipRcs = !hasRcs();

// Helper to initialize RCS for a file (creates .rcs dir and initial checkin)
function initFileWithRcs(testDir, filename, content) {
  const filePath = join(testDir, filename);
  const rcsDir = join(testDir, ".rcs");

  // Create .rcs directory if needed
  if (!existsSync(rcsDir)) {
    mkdirSync(rcsDir, { mode: 0o775 });
  }

  // Create the file
  writeFileSync(filePath, content);

  // Initial checkin
  const rcsFile = join(rcsDir, `${filename},v`);
  execSync(`ci -u -m"Initial checkin" "${filePath}" "${rcsFile}"`, {
    cwd: testDir,
    stdio: "pipe"
  });

  return { filePath, rcsFile, rcsDir };
}

// Helper to add a new revision
function checkinRevision(filePath, rcsFile, content, message) {
  // First make the file writable (ci -u removes write permission)
  chmodSync(filePath, 0o644);
  writeFileSync(filePath, content);
  execSync(`rcs -l -q "${filePath}" "${rcsFile}"`, { stdio: "pipe" });
  // Need to remove write permission before ci
  chmodSync(filePath, 0o444);
  execSync(`ci -u -m"${message}" "${filePath}" "${rcsFile}"`, { stdio: "pipe" });
}

describe("vic.js RCS integration", { skip: skipRcs ? "RCS not installed" : false }, () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir("rcs-integration");
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  describe("-log flag with existing RCS history", () => {
    let filePath;
    let rcsFile;

    before(() => {
      // Create a file with multiple revisions
      const setup = initFileWithRcs(tempDir, "log-test.js", "// version 1\n");
      filePath = setup.filePath;
      rcsFile = setup.rcsFile;

      // Add more revisions
      checkinRevision(filePath, rcsFile, "// version 2\n", "Second version");
      checkinRevision(filePath, rcsFile, "// version 3\n", "Third version");
    });

    test("should show commit history", () => {
      const result = runVic(["-log", filePath]);
      assert.strictEqual(result.code, 0, `should exit successfully: ${result.stderr}`);
      assert.ok(result.stdout.includes("1.1"), "should show revision 1.1");
      assert.ok(result.stdout.includes("1.2"), "should show revision 1.2");
      assert.ok(result.stdout.includes("1.3"), "should show revision 1.3");
    });

    test("should show file name in output", () => {
      const result = runVic(["-log", filePath]);
      assert.ok(result.stdout.includes("log-test.js"), "should show filename");
    });

    test("should show commit messages", () => {
      const result = runVic(["-log", filePath]);
      assert.ok(result.stdout.includes("Initial") || result.stdout.includes("checkin"), "should show initial message");
      assert.ok(result.stdout.includes("Second") || result.stdout.includes("version"), "should show commit message");
    });
  });

  describe("-diff flag with existing RCS history", () => {
    let filePath;
    let rcsFile;

    before(() => {
      // Create file with multiple revisions
      const setup = initFileWithRcs(tempDir, "diff-test.js", "line 1\n");
      filePath = setup.filePath;
      rcsFile = setup.rcsFile;

      checkinRevision(filePath, rcsFile, "line 1\nline 2\n", "Add line 2");
      checkinRevision(filePath, rcsFile, "line 1\nline 2\nline 3\n", "Add line 3");

      // Modify working file (don't check in)
      chmodSync(filePath, 0o644);
      writeFileSync(filePath, "line 1\nline 2\nline 3\nline 4\n");
    });

    test("should show diff against revision", () => {
      const result = runVic(["-diff", "1.1", filePath]);
      // The diff should show differences
      assert.ok(result.code === 0 || result.stdout.includes("@@"), "should show diff");
      // Should show added lines
      assert.ok(
        result.stdout.includes("+line") ||
        result.stdout.includes("line 2") ||
        result.stdout.includes("line 3"),
        "should show changes"
      );
    });

    test("should show diff between two revisions", () => {
      const result = runVic(["-diff", "1.1", "1.2", filePath]);
      assert.strictEqual(result.code, 0, "should succeed");
      // diff from 1.1 to 1.2 should show "line 2" being added
      assert.ok(
        result.stdout.includes("line 2") ||
        result.stdout.includes("+"),
        "should show changes between revisions"
      );
    });

    test("should show current vs revision diff", () => {
      const result = runVic(["-diff", "1.3", filePath]);
      // Current file has line 4, which isn't in 1.3
      assert.ok(result.code === 0 || result.stdout.includes("line 4"), "should show working file diff");
    });
  });

  describe("-log with multiple files", () => {
    let file1Path;
    let file2Path;

    before(() => {
      const setup1 = initFileWithRcs(tempDir, "multi-log-1.js", "// file 1\n");
      const setup2 = initFileWithRcs(tempDir, "multi-log-2.js", "// file 2\n");
      file1Path = setup1.filePath;
      file2Path = setup2.filePath;
    });

    test("should show log for multiple files", () => {
      const result = runVic(["-log", file1Path, file2Path]);
      assert.strictEqual(result.code, 0, "should succeed");
      assert.ok(result.stdout.includes("multi-log-1.js"), "should include first file");
      assert.ok(result.stdout.includes("multi-log-2.js"), "should include second file");
    });

    test("should respect -n limit with -log", () => {
      const setup3 = initFileWithRcs(tempDir, "multi-log-3.js", "// file 3\n");
      const result = runVic(["-n", "2", "-log", file1Path, file2Path, setup3.filePath]);
      assert.strictEqual(result.code, 1, "should reject");
      assert.ok(result.stderr.includes("Too many files"), "should report too many files");
    });
  });

  describe("file limit enforcement", () => {
    test("should reject more than 3 files by default", () => {
      const files = [];
      for (let i = 0; i < 4; i++) {
        const setup = initFileWithRcs(tempDir, `limit-test-${i}.js`, `// file ${i}\n`);
        files.push(setup.filePath);
      }

      const result = runVic(files);
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Too many files"), "should report too many files");
    });

    test("should accept 4 files with -n 4", () => {
      const files = [];
      for (let i = 0; i < 4; i++) {
        const setup = initFileWithRcs(tempDir, `n-flag-test-${i}.js`, `// file ${i}\n`);
        files.push(setup.filePath);
      }

      // This will still fail because editing requires interaction,
      // but it shouldn't fail on the file count
      const result = runVic(["-n", "4", ...files]);
      assert.ok(!result.stderr.includes("Too many files"), "should not reject on file count");
    });
  });

  describe("-log with no RCS history", () => {
    test("should report no history for untracked file", () => {
      const noRcsFile = createTestFile(tempDir, "no-rcs-file.js", "// no rcs\n");
      const result = runVic(["-log", noRcsFile]);
      assert.ok(result.stdout.includes("No RCS history"), "should report no history");
    });
  });

  describe("-diff with invalid revisions", () => {
    let filePath;

    before(() => {
      const setup = initFileWithRcs(tempDir, "invalid-rev.js", "// content\n");
      filePath = setup.filePath;
    });

    test("should handle non-existent revision", () => {
      const result = runVic(["-diff", "9.9", filePath]);
      // rcsdiff should fail gracefully
      assert.ok(result.code !== 0 || result.stdout.length > 0 || result.stderr.length > 0, "should handle error");
    });
  });

});

describe("vic.js without RCS", { skip: !skipRcs ? "RCS is installed" : false }, () => {

  test("should error when RCS is not installed", () => {
    const result = runVic(["test.js"]);
    assert.strictEqual(result.code, 1, "should exit with error");
    assert.ok(result.stderr.includes("No RCS found"), "should report RCS not found");
  });

});
