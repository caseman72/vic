#!/usr/bin/env bun
/**
 * vic.js
 *
 * Edit files with RCS version control and syntax checking
 * JavaScript port of the original Perl vic script
 *
 * Based on vic by Dave Regan (regan@ao.com) - 8 May 2000
 * Modified by Casey Manion (casey@manion.com) - 7 Nov 2005
 * Ported to javascrip by Casey Manion (casey@manion.com) & Claude - 19 Jan 2026
 */

import { spawn, execSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, statSync, lstatSync, writeFileSync, unlinkSync, realpathSync, chmodSync } from "fs";
import { dirname, basename, resolve } from "path";
import { createInterface } from "readline";

// Find available commands
function which(cmd) {
  try {
    return execSync(`which ${cmd} 2>/dev/null`, { encoding: "utf8" }).trim();
  }
  catch {
    return "";
  }
}

// Configuration
const RCS_ROOT = dirname(which("rcs"));
const RCS_DIR = ".rcs";
const RCS_CHECKOUT = `${RCS_ROOT}/co -l -zLT`;
const RCS_CHECKIN_BASE = `${RCS_ROOT}/ci -u -zLT`;
const RCS_LOCK = `${RCS_ROOT}/rcs -l -q -zLT`;
const RCS_UNLOCK = `${RCS_ROOT}/rcs -u -q -zLT`;
const RCS_DIFF = `${RCS_ROOT}/rcsdiff -u -zLT`;
const RLOG = `${RCS_ROOT}/rlog -zLT`;
const EDITOR = process.env.VISUAL || process.env.EDITOR || "vi";
const HOME_DIR = process.env.HOME;
const VERSION = "1.1.1";

// XCS bundle configuration
const XCS_ROOT = `${HOME_DIR}/.xcs`;  // Base for remote .xcs RCS stores
const XATTR_KEY = "com.manion.rcs.path";
const IS_MACOS = process.platform === "darwin";

// =============================================================================
// CLAUDE AI COMMIT MESSAGE PROMPT
// Modify this prompt to customize how Claude summarizes your changes
// =============================================================================
const CLAUDE_PROMPT = `You are a commit message generator. Analyze the following unified diff and write a concise, descriptive RCS commit message.

Rules:
- Write a single line summary (max 72 chars) describing WHAT changed
- Focus on the functional change, not the mechanics (avoid "changed line X")
- Use imperative mood ("Add feature" not "Added feature")
- Be specific but concise
- If multiple changes, summarize the main theme
- Output ONLY the commit message, nothing else

Diff:
`;

// Syntax check flag
let enableSyntaxCheck = false;

const CLAUDE_CLI = which("claude");

// Shared readline interface for user input
let rl = null;

function getReadline() {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  return rl;
}

function closeReadline() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function prompt(question) {
  return new Promise((res) => {
    // After editor closes, stdin may need to be resumed
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }
    getReadline().question(question, (answer) => {
      res(answer);
    });
  });
}

// Run shell command synchronously
function shell(cmd, options = {}) {
  try {
    const result = spawnSync("bash", ["-c", cmd], {
      stdio: options.silent ? "pipe" : "inherit",
      encoding: "utf8"
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
  }
  catch (e) {
    return { code: 1, stdout: "", stderr: e.message };
  }
}

// Generate commit message using Claude AI
function generateCommitMessage(diff) {
  if (!CLAUDE_CLI || !diff || diff.trim() === "") {
    return "-"; // Default message if no Claude or no diff
  }

  try {
    // console.log("\n--- Generating commit message with Claude ---");
    const fullPrompt = CLAUDE_PROMPT + diff;

    // Use Claude CLI with --print flag to get output directly
    const result = spawnSync(CLAUDE_CLI, ["--print", "--max-turns", "1", fullPrompt], {
      encoding: "utf8",
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024
    });

    if (result.status === 0 && result.stdout) {
      const message = result.stdout.trim();
      // Sanitize: remove quotes that might break RCS command
      const sanitized = message.replace(/"/g, "'").replace(/\n/g, " ").substring(0, 200);
      return sanitized || "-";
    }
  }
  catch (e) {
    console.log(`Claude error: ${e.message}`);
  }

  return "-";
}

// format console underline
function underlineMessage(string) {
  return `\x1b[4m${string}\x1b[0m`;
};

// Read xattr from directory (returns relative path or null)
function getXattrPath(dir) {
  try {
    let result;
    if (IS_MACOS) {
      result = execSync(`xattr -p ${XATTR_KEY} "${dir}" 2>/dev/null`, { encoding: "utf8" });
    }
    else {
      result = execSync(`getfattr -n user.${XATTR_KEY} --only-values "${dir}" 2>/dev/null`, { encoding: "utf8" });
    }
    return result.trim() || null;
  }
  catch {
    return null;
  }
}

// Write xattr to directory (stores relative path)
function setXattrPath(dir, relativePath) {
  try {
    if (IS_MACOS) {
      execSync(`xattr -w ${XATTR_KEY} "${relativePath}" "${dir}"`, { stdio: "pipe" });
    }
    else {
      execSync(`setfattr -n user.${XATTR_KEY} -v "${relativePath}" "${dir}"`, { stdio: "pipe" });
    }
  }
  catch {
    // Silent failure - xattr is optional enhancement
  }
}

// Remove invalid xattr from directory
function removeXattr(dir) {
  try {
    if (IS_MACOS) {
      execSync(`xattr -d ${XATTR_KEY} "${dir}" 2>/dev/null`, { stdio: "pipe" });
    }
    else {
      execSync(`setfattr -x user.${XATTR_KEY} "${dir}" 2>/dev/null`, { stdio: "pipe" });
    }
  }
  catch {
    // Silent failure
  }
}

// Find the .xcs bundle root by walking up from filePath
function findXcsBundleRoot(filePath) {
  let current = resolve(filePath);

  // If filePath is a file, start from its directory
  if (existsSync(current) && statSync(current).isFile()) {
    current = dirname(current);
  }

  while (current !== "/" && current !== HOME_DIR) {
    if (current.endsWith(".xcs")) {
      return current;
    }
    current = dirname(current);
  }
  return null;
}

// Generate a hint for remote RCS path based on current directory
function getPathHint(dir) {
  let hint = dir;

  // Remove HOME_DIR prefix
  if (hint.startsWith(HOME_DIR)) {
    hint = hint.slice(HOME_DIR.length);
  }
  // Remove /Volumes/xxx/ prefix
  else if (hint.startsWith("/Volumes/")) {
    hint = hint.replace(/^\/Volumes\/[^/]+/, "");
  }

  // Clean leading/trailing slashes
  return hint.replace(/^\/+/, "").replace(/\/+$/, "");
}

// Prompt user for RCS path (like RCS ci style)
async function promptForRcsPath(localDir) {
  const hint = getPathHint(localDir);
  console.log("No RCS directory. Enter remote path or <enter>");
  const answer = await prompt(`  hint: ${hint}\n> `);
  const trimmed = answer.trim();

  if (trimmed === "" || trimmed === ".") {
    // Local .rcs/ directory (default)
    return { relative: ".", full: `${localDir}/${RCS_DIR}` };
  }

  // Remote path under ~/.xcs/
  const relativePath = trimmed.replace(/^\/+/, "").replace(/\/+$/, ""); // Clean slashes
  return { relative: relativePath, full: `${XCS_ROOT}/${relativePath}` };
}

// Resolve RCS store path - works for any directory without existing .rcs
// For .xcs bundles, stores xattr on bundle root; otherwise on file's directory
async function resolveRcsPath(filePath, fileDir) {
  // Determine where to store xattr: .xcs bundle root or file's directory
  const xcsRoot = findXcsBundleRoot(filePath);
  const xattrDir = xcsRoot || fileDir;
  const localDir = xcsRoot || fileDir;

  // Check for existing xattr
  const xattrValue = getXattrPath(xattrDir);

  if (xattrValue) {
    // Resolve the full path
    let fullPath;
    if (xattrValue === ".") {
      fullPath = `${localDir}/${RCS_DIR}`;
    }
    else {
      fullPath = `${XCS_ROOT}/${xattrValue}`;
    }

    // Validate the path exists
    if (existsSync(fullPath)) {
      return fullPath;
    }

    // Invalid xattr - remove it and fall through to prompt
    removeXattr(xattrDir);
  }

  // No xattr or invalid - prompt user
  const pathInfo = await promptForRcsPath(localDir);

  // Close readline so RCS can use stdin
  closeReadline();

  // Create the directory
  if (!existsSync(pathInfo.full)) {
    try {
      mkdirSync(pathInfo.full, { recursive: true, mode: 0o775 });
    }
    catch (e) {
      console.log(`Error creating directory ${pathInfo.full}: ${e.message}`);
      return null;
    }
  }

  // Set xattr for future use
  setXattrPath(xattrDir, pathInfo.relative);

  return pathInfo.full;
}

// Get the name of the person who holds the lock
// rcsBasePath is optional - if provided, it's the RCS directory path (already resolved)
function getLockersName(fname, rcsBasePath = null) {
  const baseName = basename(fname);
  let rcsDir;

  if (rcsBasePath) {
    // Use the provided RCS path directly (already complete)
    rcsDir = rcsBasePath;
  }
  else {
    // Default behavior - local .rcs directory
    rcsDir = `${dirname(fname)}/${RCS_DIR}`;
  }

  try {
    const result = execSync(`${RLOG} "${fname}" "${rcsDir}/${baseName},v" 2>/dev/null | grep "locked by:"`, {
      encoding: "utf8"
    });
    let lname = result.trim();
    lname = lname.replace(/.*locked by: /, "");
    lname = lname.replace(/;.*/, "");
    return lname;
  }
  catch {
    return "";
  }
}

// Run ESLint on JavaScript/TypeScript files
async function runSyntaxCheck(fname) {
  if (!enableSyntaxCheck) {
    console.log("");
    return;
  }

  // Dynamic import ESLint
  const { ESLint } = await import("eslint");

  const eslintOptions = {
    overrideConfigFile: true,
    overrideConfig: []
  };

  const ext = fname.split(".").pop().toLowerCase();

  // and rules - seperate files to easily fine tune them
  if (["js", "ts", "jsx", "tsx", "mjs", "mts"].includes(ext)) {
    const jsOptions = await import("./lib/eslint-js");
    eslintOptions.overrideConfig.push(...jsOptions.default);
  }
  else if (["htm", "html"].includes(ext)) {
    const htmOptions = await import("./lib/eslint-htm");
    eslintOptions.overrideConfig.push(...htmOptions.default);
  }
  else if (["css"].includes(ext)) {
    const cssOptions = await import("./lib/eslint-css");
    eslintOptions.overrideConfig.push(...cssOptions.default);
  }
  else if (["json", "jsonc", "json5" ].includes(ext)) {
    const jsonOptions = await import("./lib/eslint-json");
    eslintOptions.overrideConfig.push(...jsonOptions.default);
  }
  else {
    console.log("");
    return;
  }

  try {
    // Create ESLint instance
    const eslint = new ESLint(eslintOptions);

    // Lint the file
    const results = await eslint.lintFiles([fname]);

    // Format and print results
    const formatter = await eslint.loadFormatter("stylish");
    const output = await formatter.format(results);

    // File OK - nothing to fix
    if (!output) {
      console.log("");
      return;
    }

    // log like the rcs output
    console.log(output.split("\n").map((r,i) => {
      if (i === 1) {
        return r + "  ---  " + r.replace(/^.*\/(.*)$/, "$1");
      }
      return r;
    }).join("\n"));
  }
  catch (e) {
    console.error(`ESLint error: ${e.message}`);
  }
}

// Checkout a file from RCS - returns file info for later checkin, or null on failure
async function checkoutFile(fname) {
  let dirName = dirname(resolve(fname));
  let baseName = basename(fname);

  // Handle symbolic links - use lstatSync to detect symlinks (statSync follows them)
  if (existsSync(fname)) {
    try {
      const lstats = lstatSync(fname);
      if (lstats.isSymbolicLink()) {
        const realPath = realpathSync(fname); // Resolves to absolute path
        console.log(`${fname} is a symbolic link to ${realPath}`);
        const ans = await prompt("Edit the linked file? [Y/n] ");
        if (/n/i.test(ans)) return null;
        fname = realPath;
        // Update dirname/basename for the resolved path
        dirName = dirname(fname);
        baseName = basename(fname);
      }
    }
    catch (e) {
      // Broken symlink or other error - try to continue
      console.log(`Warning: ${e.message}`);
    }
  }

  // Ensure file exists
  if (!existsSync(fname)) {
    try {
      writeFileSync(fname, "");
      // Let file use default umask permissions
    }
    catch (e) {
      console.log(`Cannot create ${fname}: ${e.message}`);
      return null;
    }
  }

  // Check for hard links and capture original permissions
  const stats = statSync(fname);
  let originalMode = stats.mode;
  if (stats.nlink > 1) {
    console.log(`There are ${stats.nlink} links to this file.`);
    console.log("It is best to delete all names except one before continuing.");
    return null;
  }

  // Determine RCS path - check for existing local .rcs first
  let rcsPath;
  let rcsBasePath = null; // Track base path for getLockersName
  const fullPath = resolve(fname);
  const localRcsPath = `${dirName}/${RCS_DIR}`;

  if (existsSync(localRcsPath)) {
    // Use existing local .rcs directory
    rcsPath = localRcsPath;
  }
  else {
    // No local .rcs - resolve via xattr or prompt
    // For local ("."), returns path with .rcs; for remote, returns path as-is (no .rcs needed)
    rcsBasePath = await resolveRcsPath(fullPath, dirName);
    if (!rcsBasePath) {
      return null;
    }
    rcsPath = rcsBasePath;
  }

  // Ensure RCS directory exists
  if (!existsSync(rcsPath)) {
    try {
      mkdirSync(rcsPath, { recursive: true, mode: 0o775 });
    }
    catch (e) {
      console.log(`Permission denied creating directory ${rcsPath}: ${e.message}`);
      return null;
    }
  }

  // Check in if no RCS entry exists
  const rcsFile = `${rcsPath}/${baseName},v`;
  if (!existsSync(rcsFile)) {
    console.log(`\nNOTE: ${fname} has never been checked into RCS`);
    // console.log(`Checking in via '${RCS_CHECKIN_BASE}'\n`);
    shell(`${RCS_CHECKIN_BASE} -m"Initial checkin" "${fname}" "${rcsFile}"`);
  }

  // Check if file is locked by someone else
  let lname = getLockersName(fname, rcsBasePath);
  if (lname) {
    console.log(`ERROR: "${fname}" locked (checked out) by: ${lname}`);
    console.log("       You can force an unlock, but be sure they're not editing it.");
    const ans = await prompt("\nDo you want to unlock the file? ");
    if (!/y/i.test(ans)) return null;
    shell(`${RCS_UNLOCK} "${fname}" "${rcsFile}"`);
  }

  // Check for uncommitted changes
  const tmpFile = `/tmp/${process.pid}.vic`;
  const diffResult = shell(`${RCS_DIFF} "${fname}" "${rcsFile}" >${tmpFile} 2>/dev/null`, { silent: true });

  if (diffResult.code !== 0) {
    console.log("\nERROR: File has been changed since last check in.");
    console.log(`       Someone edited "${fname}" without checking in their changes.\n`);
    console.log("       Here are the changes:");
    shell(`cat ${tmpFile}`);
    try {
      unlinkSync(tmpFile);
    }
    catch { /* ignore */ }
    console.log("\n  '<' = RCS has information that the file does not.");
    console.log("  '>' = The file has information that RCS does not.\n");
    console.log("Options:");
    console.log("     1. Check the changes into RCS");
    console.log("     2. Exit");
    console.log("     3. Ignore changes and continue (DANGEROUS)");
    const ans = await prompt("---> ");

    if (/1/.test(ans)) {
      console.log("");
      shell(`${RCS_LOCK} "${fname}" "${rcsFile}"`);
      shell(`${RCS_CHECKIN_BASE} -m"Sync uncommitted changes" "${fname}" "${rcsFile}"`);
      // Re-capture permissions after ci (ci -u changes them)
      const newStats = statSync(fname);
      originalMode = newStats.mode;
      console.log("");
    }
    else if (!/3/.test(ans)) {
      console.log("No changes made");
      return null;
    }
  }

  try {
    unlinkSync(tmpFile);
  }
  catch { /* ignore */ }

  // Remove write permissions from RCS file (working file is source of truth)
  try {
    const readOnlyMode = originalMode & ~0o222; // Strip write bits
    chmodSync(rcsFile, readOnlyMode);
  }
  catch { /* ignore */ }

  // Remove write from working file before checkout (RCS expects this)
  try {
    const readOnlyMode = originalMode & ~0o222;
    chmodSync(fname, readOnlyMode);
  }
  catch { /* ignore */ }

  // Checkout
  const coResult = shell(`${RCS_CHECKOUT} "${fname}" "${rcsFile}"`);
  if (coResult.code !== 0) {
    console.log(`Checkout failed for ${fname}`);
    return null;
  }

  lname = getLockersName(fname, rcsBasePath);
  if (!lname) {
    console.log(`Could not lock ${fname}.`);
    return null;
  }

  console.log(""); // add new line after done

  return { fname, rcsFile, baseName, originalMode, rcsBasePath };
}

// Checkin a file to RCS
async function checkinFile(fileInfo) {
  const { fname, rcsFile, originalMode, rcsBasePath } = fileInfo;

  // Get diff for commit message generation
  const diffTmpFile = `/tmp/${process.pid}.${basename(fname)}.diff`;
  shell(`${RCS_DIFF} "${fname}" "${rcsFile}" >${diffTmpFile} 2>/dev/null`, { silent: true });

  let commitMessage = "-";
  try {
    const diffContent = execSync(`cat "${diffTmpFile}"`, { encoding: "utf8" });
    if (diffContent.trim()) {
      commitMessage = generateCommitMessage(diffContent);
    }
    else {
      // console.log(".410."); // NO DIFF
    }
    unlinkSync(diffTmpFile);
  }
  catch {
    // No diff or error reading - use default message
  }

  if (commitMessage !== "-") {
    // log like the ESLint with underline
    console.log(`${underlineMessage("Commit message:")}\n${commitMessage}\n`);
  }

  // Check back in with generated commit message
  shell(`${RCS_CHECKIN_BASE} -m"${commitMessage}" "${fname}" "${rcsFile}"`);

  let lname = getLockersName(fname, rcsBasePath);
  if (lname) {
    shell(`${RCS_UNLOCK} "${fname}" "${rcsFile}"`);
    console.log(`File ${fname} has been unlocked.`);
  }

  // Restore original permissions
  try {
    chmodSync(fname, originalMode);
  }
  catch { /* ignore */ }

  // Run syntax check
  await runSyntaxCheck(fname);
}

// Show commit history for a file
async function showCommits(fname) {
  const dirName = dirname(resolve(fname));
  const baseName = basename(fname);
  const localRcsPath = `${dirName}/${RCS_DIR}`;

  // Determine RCS file location
  let rcsFile;
  if (existsSync(localRcsPath)) {
    rcsFile = `${localRcsPath}/${baseName},v`;
  }
  else {
    // Check xattr for remote path
    const xcsRoot = findXcsBundleRoot(resolve(fname));
    const xattrDir = xcsRoot || dirName;
    const xattrValue = getXattrPath(xattrDir);

    if (xattrValue && xattrValue !== ".") {
      rcsFile = `${XCS_ROOT}/${xattrValue}/${baseName},v`;
    }
    else if (xattrValue === ".") {
      const localDir = xcsRoot || dirName;
      rcsFile = `${localDir}/${RCS_DIR}/${baseName},v`;
    }
    else {
      console.log(`No RCS history found for ${fname}`);
      return;
    }
  }

  if (!existsSync(rcsFile)) {
    console.log(`No RCS history found for ${fname}`);
    return;
  }

  // Get rlog output and parse it
  try {
    const result = execSync(`${RLOG} "${rcsFile}" 2>/dev/null`, { encoding: "utf8" });
    const lines = result.split("\n");

    let inRevision = false;
    let currentRev = "";
    let currentDate = "";
    let currentMsg = [];
    const entries = [];

    for (const line of lines) {
      if (line.startsWith("revision ")) {
        // Store previous revision if exists
        if (currentRev && currentMsg.length) {
          const msg = currentMsg.join(" ").trim();
          entries.push({ rev: currentRev, date: currentDate, msg });
        }
        currentRev = line.replace("revision ", "").trim();
        currentMsg = [];
        inRevision = true;
      }
      else if (inRevision && line.startsWith("date: ")) {
        // Parse date line: "date: 2026/01/20 10:30:00;  author: user;  state: Exp;  lines: +1 -0"
        const dateMatch = line.match(/date: ([^;]+);/);
        if (dateMatch) {
          currentDate = dateMatch[1].trim();
        }
      }
      else if (inRevision && line.startsWith("----------------------------")) {
        // End of this revision's message, next revision coming
        if (currentRev && currentMsg.length) {
          const msg = currentMsg.join(" ").trim();
          entries.push({ rev: currentRev, date: currentDate, msg });
        }
        currentRev = "";
        currentMsg = [];
        inRevision = false;
      }
      else if (inRevision && line.startsWith("===")) {
        // End of log
        if (currentRev && currentMsg.length) {
          const msg = currentMsg.join(" ").trim();
          entries.push({ rev: currentRev, date: currentDate, msg });
        }
      }
      else if (inRevision && line && !line.startsWith("date:") && !line.startsWith("branches:")) {
        currentMsg.push(line);
      }
    }

    // Output in reverse order (oldest first)
    console.log(`\n${underlineMessage(fname)}\n`);
    for (const entry of entries.reverse()) {
      console.log(`  ${entry.rev}  ${entry.date}  ${entry.msg}`);
    }
    console.log("");
  }
  catch (e) {
    console.log(`Error reading RCS history: ${e.message}`);
  }
}

// Show diff between revisions
async function showDiff(fname, rev1, rev2 = null) {
  const dirName = dirname(resolve(fname));
  const baseName = basename(fname);
  const localRcsPath = `${dirName}/${RCS_DIR}`;

  // Determine RCS file location
  let rcsFile;
  if (existsSync(localRcsPath)) {
    rcsFile = `${localRcsPath}/${baseName},v`;
  }
  else {
    // Check xattr for remote path
    const xcsRoot = findXcsBundleRoot(resolve(fname));
    const xattrDir = xcsRoot || dirName;
    const xattrValue = getXattrPath(xattrDir);

    if (xattrValue && xattrValue !== ".") {
      rcsFile = `${XCS_ROOT}/${xattrValue}/${baseName},v`;
    }
    else if (xattrValue === ".") {
      const localDir = xcsRoot || dirName;
      rcsFile = `${localDir}/${RCS_DIR}/${baseName},v`;
    }
    else {
      console.log(`No RCS history found for ${fname}`);
      return;
    }
  }

  if (!existsSync(rcsFile)) {
    console.log(`No RCS history found for ${fname}`);
    return;
  }

  // Build rcsdiff command
  let diffCmd;
  if (rev2) {
    // Compare two revisions
    diffCmd = `${RCS_DIFF} -r${rev1} -r${rev2} "${fname}" "${rcsFile}"`;
  }
  else {
    // Compare revision to current working file
    diffCmd = `${RCS_DIFF} -r${rev1} "${fname}" "${rcsFile}"`;
  }

  console.log(`\n${underlineMessage(fname)} (${rev1} vs ${rev2 || "current"})\n`);
  shell(diffCmd);
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: vic [-pc] [-n NUM] [-log] [-diff REV [REV]] file1 ...");
    process.exit(1);
  }

  if (RCS_ROOT === "." || RCS_ROOT === "") {
    console.error("No RCS found! Install: brew install rcs");
    process.exit(1);
  }

  if (args.includes("--version")) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle -pc flag for syntax checking (ESLint for JS/TS)
  if (args[0] === "-pc") {
    args.shift();
    enableSyntaxCheck = true;
  }

  // Handle -n flag for max file count (default 3)
  let maxFiles = 3;
  if (args[0] === "-n") {
    args.shift();
    maxFiles = parseInt(args.shift(), 10) || 3;
  }

  // Handle -log flag to show commit history (ignores -pc)
  if (args[0] === "-log") {
    args.shift();
    if (args.length > maxFiles) {
      console.error(`Too many files (${args.length}). Maximum is ${maxFiles}.`);
      console.error("Use -n NUM to increase the limit, e.g.: vic -n 5 -log file1 file2 ...");
      process.exit(1);
    }
    for (const fname of args) {
      await showCommits(fname);
    }
    return;
  }

  // Handle -diff flag to show diff between revisions (ignores -pc, only 1 file)
  if (args[0] === "-diff") {
    args.shift();
    // Parse revision(s) - format: -diff REV [REV] file
    const revPattern = /^\d+\.\d+$/;
    const rev1 = args[0];
    if (!rev1 || !revPattern.test(rev1)) {
      console.error("Usage: vic -diff REV [REV] file");
      console.error("  vic -diff 1.1 file.js        # diff 1.1 vs current");
      console.error("  vic -diff 1.1 1.3 file.js    # diff 1.1 vs 1.3");
      process.exit(1);
    }
    args.shift();

    let rev2 = null;
    if (args[0] && revPattern.test(args[0])) {
      rev2 = args.shift();
    }

    if (args.length !== 1) {
      console.error("Error: -diff requires exactly 1 file");
      process.exit(1);
    }

    await showDiff(args[0], rev1, rev2);
    return;
  }

  // Limit file count
  if (args.length > maxFiles) {
    console.error(`Too many files (${args.length}). Maximum is ${maxFiles}.`);
    console.error("Use -n NUM to increase the limit, e.g.: vic -n 5 file1 file2 ...");
    process.exit(1);
  }

  console.log("");

  // If under ~/.xcs directory, just spawn editor and exit (no RCS handling)
  const cwd = process.cwd();
  if (cwd.startsWith(`${XCS_ROOT}/`) || cwd === XCS_ROOT) {
    const editor = spawn(EDITOR, args, { stdio: "inherit" });
    await new Promise((res) => editor.on("close", res));
    return;
  }

  // Checkout all files first
  const checkedOutFiles = [];
  for (const fname of args) {
    const fileInfo = await checkoutFile(fname);
    if (fileInfo) {
      checkedOutFiles.push(fileInfo);
    }
  }

  // If no files were checked out, exit
  if (checkedOutFiles.length === 0) {
    console.log("No files to edit.");
    closeReadline();
    return;
  }

  // Open editor with ALL files at once
  closeReadline();
  const filePaths = checkedOutFiles.map(f => f.fname);
  const editor = spawn(EDITOR, filePaths, { stdio: "inherit" });
  await new Promise((res) => editor.on("close", res));

  if (checkedOutFiles.length > 1) {
    console.log(""); // adds line after x files to edit
  }

  // Checkin all files
  // console.log("\n--- Checking in files ---");
  for (const fileInfo of checkedOutFiles) {
    await checkinFile(fileInfo);
  }

  // Clean up
  closeReadline();
}

main().catch(console.error);
