/**
 * Test helpers for vic.js tests
 */

import { spawn, execSync, spawnSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = dirname(__dirname);
export const VIC_PATH = join(PROJECT_ROOT, "vic.js");

// Create a temporary test directory
export function createTempDir(name) {
  const tempDir = join(PROJECT_ROOT, "test", ".tmp", name);
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

// Clean up temp directory
export function cleanupTempDir(tempDir) {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
}

// Create a test file
export function createTestFile(dir, filename, content = "") {
  const filePath = join(dir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

// Read a test file
export function readTestFile(filePath) {
  return readFileSync(filePath, "utf8");
}

// Run vic.js as subprocess with arguments
export function runVic(args, options = {}) {
  const { cwd, input, timeout = 5000 } = options;

  const result = spawnSync("node", [VIC_PATH, ...args], {
    cwd: cwd || PROJECT_ROOT,
    input: input,
    encoding: "utf8",
    timeout,
    env: { ...process.env, EDITOR: "true" } // Use 'true' command as editor (does nothing)
  });

  return {
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    signal: result.signal
  };
}

// Run vic.js with PTY simulation for interactive tests
export async function runVicInteractive(args, inputs = [], options = {}) {
  const { cwd, timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn("node", [VIC_PATH, ...args], {
      cwd: cwd || PROJECT_ROOT,
      env: { ...process.env, EDITOR: "true" },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let inputIndex = 0;

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      // Send next input when we see a prompt
      if (inputIndex < inputs.length && (stdout.includes("?") || stdout.includes(":"))) {
        setTimeout(() => {
          if (inputIndex < inputs.length) {
            proc.stdin.write(inputs[inputIndex] + "\n");
            inputIndex++;
          }
        }, 100);
      }
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Send first input after a short delay
    if (inputs.length > 0) {
      setTimeout(() => {
        proc.stdin.write(inputs[inputIndex] + "\n");
        inputIndex++;
      }, 500);
    }
  });
}

// Check if RCS is installed
export function hasRcs() {
  try {
    execSync("which rcs", { encoding: "utf8", stdio: "pipe" });
    return true;
  }
  catch {
    return false;
  }
}

// Initialize RCS for a test file
export function initRcs(testDir, filename) {
  const rcsDir = join(testDir, ".rcs");
  if (!existsSync(rcsDir)) {
    mkdirSync(rcsDir, { mode: 0o775 });
  }

  const filePath = join(testDir, filename);
  const rcsFile = join(rcsDir, `${filename},v`);

  // Create initial checkin
  try {
    execSync(`ci -u -m"Initial checkin" "${filePath}" "${rcsFile}"`, {
      cwd: testDir,
      stdio: "pipe"
    });
    return true;
  }
  catch {
    return false;
  }
}
