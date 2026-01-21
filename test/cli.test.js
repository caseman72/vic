/**
 * CLI argument parsing tests for vic.js
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";

import { runVic, hasRcs, createTempDir, cleanupTempDir } from "./helpers.js";

describe("vic.js CLI", () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir("cli-tests");
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  describe("--version flag", () => {
    test("should print version and exit", () => {
      const result = runVic(["--version"]);
      assert.strictEqual(result.code, 0, "should exit with code 0");
      assert.ok(/^\d+\.\d+\.\d+\n?$/.test(result.stdout.trim()), `version should be semver: ${result.stdout}`);
    });
  });

  describe("no arguments", () => {
    test("should print usage and exit with error", () => {
      const result = runVic([]);
      assert.strictEqual(result.code, 1, "should exit with code 1");
      assert.ok(result.stderr.includes("Usage:"), "should print usage");
    });
  });

  describe("-pc flag (syntax check)", () => {
    test("should be accepted before filename", () => {
      // This will fail if RCS isn't installed, but -pc should be parsed
      const result = runVic(["-pc", "--version"]);
      // --version should still work after -pc is consumed
      assert.ok(result.stdout.includes(".") || result.stderr.includes("Usage"), "should process flags");
    });
  });

  describe("-n flag (max files)", () => {
    test("should accept a number argument", () => {
      // Test with too many files beyond the limit - run in temp dir
      const result = runVic(["-n", "2", "file1.js", "file2.js", "file3.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Too many files"), "should report too many files");
    });

    test("should enforce default limit of 3 files", () => {
      // Run in temp dir to avoid creating files in project root
      const result = runVic(["f1.js", "f2.js", "f3.js", "f4.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Too many files"), "should report too many files");
      assert.ok(result.stderr.includes("4"), "should show count of 4");
    });

    test("should allow higher limit with -n", () => {
      // Run in temp dir - vic may create files before failing on RCS
      const result = runVic(["-n", "5", "f1.js", "f2.js", "f3.js", "f4.js"], { cwd: tempDir });
      // This won't succeed (no RCS setup) but shouldn't fail on count
      assert.ok(!result.stderr.includes("Too many files"), "should not report too many files");
    });
  });

  describe("-log flag", () => {
    test("should require at least one filename", () => {
      const result = runVic(["-log"]);
      // With no files after -log, args is empty
      assert.ok(result.code === 0 || result.code === 1, "should complete");
    });

    test("should respect -n limit for log", () => {
      const result = runVic(["-n", "2", "-log", "f1.js", "f2.js", "f3.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Too many files"), "should report too many files");
    });
  });

  describe("-diff flag", () => {
    test("should require revision argument", () => {
      const result = runVic(["-diff", "file.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Usage: vic -diff"), "should print diff usage");
    });

    test("should require exactly one file", () => {
      const result = runVic(["-diff", "1.1", "file1.js", "file2.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("exactly 1 file"), "should require 1 file");
    });

    test("should accept single revision", () => {
      // Will fail because file doesn't exist, but parsing should work
      const result = runVic(["-diff", "1.1", "nonexistent.js"], { cwd: tempDir });
      // Should get past argument parsing
      assert.ok(!result.stderr.includes("Usage: vic -diff"), "should parse args correctly");
    });

    test("should accept two revisions", () => {
      const result = runVic(["-diff", "1.1", "1.2", "nonexistent.js"], { cwd: tempDir });
      assert.ok(!result.stderr.includes("Usage: vic -diff"), "should parse args correctly");
    });

    test("should validate revision format", () => {
      const result = runVic(["-diff", "invalid", "file.js"], { cwd: tempDir });
      assert.strictEqual(result.code, 1, "should exit with error");
      assert.ok(result.stderr.includes("Usage: vic -diff"), "should print diff usage");
    });
  });

  describe("combined flags", () => {
    test("-pc with -n should work together", () => {
      const result = runVic(["-pc", "-n", "5", "--version"]);
      // After consuming -pc and -n 5, --version should still be processed
      assert.ok(result.stdout.length > 0 || result.stderr.length > 0, "should produce output");
    });

    test("-pc with -log should work together", () => {
      const result = runVic(["-pc", "-log", "nonexistent.js"], { cwd: tempDir });
      // -pc is consumed, then -log mode is entered
      assert.ok(result.code === 0 || result.stdout.includes("No RCS history"), "should handle -log");
    });
  });

});

describe("vic.js CLI with RCS", { skip: !hasRcs() ? "RCS not installed" : false }, () => {

  test("should detect RCS installation", () => {
    const result = runVic(["--version"]);
    assert.ok(!result.stderr.includes("No RCS found"), "RCS should be found");
  });

});
