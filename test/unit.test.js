/**
 * Unit tests for vic.js utility functions
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

import {
  which,
  shell,
  underlineMessage,
  getPathHint,
  findXcsBundleRoot,
  VERSION,
  RCS_DIR,
  HOME_DIR,
  IS_MACOS
} from "../vic.js";

import { createTempDir, cleanupTempDir } from "./helpers.js";

describe("vic.js utility functions", () => {

  describe("which()", () => {
    test("should find common commands", () => {
      const nodePath = which("node");
      assert.ok(nodePath.length > 0, "node should be found");
      assert.ok(nodePath.includes("node"), "path should contain 'node'");
    });

    test("should return empty string for non-existent commands", () => {
      const result = which("nonexistent_command_xyz_123");
      assert.strictEqual(result, "", "should return empty string");
    });

    test("should find rcs if installed", () => {
      const rcsPath = which("rcs");
      // RCS might not be installed, so just check it doesn't throw
      assert.ok(typeof rcsPath === "string", "should return a string");
    });
  });

  describe("shell()", () => {
    test("should execute simple commands", () => {
      const result = shell("echo hello", { silent: true });
      assert.strictEqual(result.code, 0, "exit code should be 0");
      assert.ok(result.stdout.includes("hello"), "stdout should contain 'hello'");
    });

    test("should return non-zero code for failing commands", () => {
      const result = shell("exit 1", { silent: true });
      assert.strictEqual(result.code, 1, "exit code should be 1");
    });

    test("should capture stderr", () => {
      const result = shell("echo error >&2", { silent: true });
      assert.ok(result.stderr.includes("error"), "stderr should contain 'error'");
    });

    test("should handle complex commands", () => {
      const result = shell("echo 'line 1' && echo 'line 2'", { silent: true });
      assert.strictEqual(result.code, 0);
      assert.ok(result.stdout.includes("line 1"));
      assert.ok(result.stdout.includes("line 2"));
    });
  });

  describe("underlineMessage()", () => {
    test("should wrap string with ANSI underline codes", () => {
      const result = underlineMessage("test");
      assert.strictEqual(result, "\x1b[4mtest\x1b[0m");
    });

    test("should handle empty string", () => {
      const result = underlineMessage("");
      assert.strictEqual(result, "\x1b[4m\x1b[0m");
    });

    test("should handle strings with special characters", () => {
      const result = underlineMessage("test/path.js:123");
      assert.ok(result.includes("test/path.js:123"));
      assert.ok(result.startsWith("\x1b[4m"));
      assert.ok(result.endsWith("\x1b[0m"));
    });
  });

  describe("getPathHint()", () => {
    test("should remove HOME_DIR prefix", () => {
      const result = getPathHint(`${HOME_DIR}/Projects/myproject`);
      assert.strictEqual(result, "Projects/myproject");
    });

    test("should remove /Volumes/xxx/ prefix", () => {
      const result = getPathHint("/Volumes/MyDrive/Projects/myproject");
      assert.strictEqual(result, "Projects/myproject");
    });

    test("should handle paths without special prefixes", () => {
      const result = getPathHint("/usr/local/bin");
      assert.strictEqual(result, "usr/local/bin");
    });

    test("should remove leading and trailing slashes", () => {
      const result = getPathHint("/some/path/");
      assert.strictEqual(result, "some/path");
    });
  });

  describe("findXcsBundleRoot()", () => {
    let tempDir;

    test("should return null for non-.xcs directories", () => {
      tempDir = createTempDir("xcs-test-1");
      const result = findXcsBundleRoot(tempDir);
      assert.strictEqual(result, null);
      cleanupTempDir(tempDir);
    });

    test("should find .xcs bundle root", () => {
      tempDir = createTempDir("xcs-test-2");
      const xcsDir = join(tempDir, "test.xcs");
      const subDir = join(xcsDir, "subdir");
      mkdirSync(subDir, { recursive: true });

      const result = findXcsBundleRoot(subDir);
      assert.strictEqual(result, xcsDir);
      cleanupTempDir(tempDir);
    });

    test("should return null for home directory", () => {
      const result = findXcsBundleRoot(HOME_DIR);
      assert.strictEqual(result, null);
    });
  });

  describe("constants", () => {
    test("VERSION should be a valid semver string", () => {
      assert.ok(/^\d+\.\d+\.\d+$/.test(VERSION), `VERSION ${VERSION} should be semver`);
    });

    test("RCS_DIR should be .rcs", () => {
      assert.strictEqual(RCS_DIR, ".rcs");
    });

    test("HOME_DIR should be set", () => {
      assert.ok(HOME_DIR.length > 0, "HOME_DIR should not be empty");
      assert.ok(existsSync(HOME_DIR), "HOME_DIR should exist");
    });

    test("IS_MACOS should be boolean", () => {
      assert.strictEqual(typeof IS_MACOS, "boolean");
    });
  });

});
