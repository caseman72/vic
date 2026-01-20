# vic

A JavaScript port of the Perl `vic` editor wrapper with RCS version control and syntax checking.

## Overview

`vic` wraps your editor (vim, etc.) with automatic RCS (Revision Control System) version control. Every time you edit a file, it:

1. Checks out the file from RCS (creates `.rcs` directory if needed)
2. Opens your editor
3. Checks the file back in after editing
4. Runs syntax checking on the file

## Installation

```bash
npm install
```

This installs the syntax checkers:
- **eslint** - JavaScript/TypeScript linting
- **htmlhint** - HTML validation
- **stylelint** - CSS/SCSS/Less linting

## Usage

```bash
# Basic usage - edit file with RCS tracking
./vic.js <file>

# Enable syntax checking after edit
./vic.js -pc <file>

# Multiple files (default max 3)
./vic.js file1.js file2.js

# Increase max file limit
./vic.js -n 5 file1.js file2.js file3.js file4.js file5.js

# Show commit history
./vic.js -log <file>

# Show commit history for multiple files
./vic.js -n 5 -log *.js
```

## What it does

1. Creates `.rcs` directory to store version history
2. Checks out file (`co`) - locks it for editing
3. Spawns your `$EDITOR` (or `$VISUAL`, defaults to `vi`)
4. **Generates commit message using Claude AI** (if installed)
5. Checks file back in (`ci`) with the AI-generated message
6. Runs syntax check based on file extension (when using `-pc`)

## Claude AI Integration

If the `claude` CLI is installed, vic automatically generates meaningful commit messages by analyzing the diff of your changes.

### How it works

1. After you save and exit the editor, vic captures the diff
2. The diff is sent to Claude with a prompt asking for a commit message
3. Claude returns a concise, descriptive message following best practices
4. The message is used as the RCS check-in comment

### Customizing the prompt

The prompt used for Claude is defined in `vic.js` as `CLAUDE_PROMPT`. You can modify it to fit your style:

```javascript
const CLAUDE_PROMPT = `You are a commit message generator...
// Edit this to customize Claude's behavior
`;
```

### Without Claude

If `claude` CLI is not installed, vic falls back to a default `-` message (same as original behavior).

## Supported Syntax Checkers

| Extension | Checker |
|-----------|---------|
| `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.mts` | ESLint |
| `.html`, `.htm` | ESLint with HTML plugin |
| `.css` | ESLint with CSS plugin |
| `.json`, `.jsonc`, `.json5` | ESLint with JSON plugin |

## Remote RCS Storage

When editing a file in a directory without an existing `.rcs/` folder, vic prompts:

```
No RCS directory. Enter remote path or <enter>
```

- **Press Enter** - Creates local `.rcs/` directory (default behavior)
- **Enter a path** (e.g., `projects/myapp`) - Stores RCS files in `~/.xcs/projects/myapp/`

The choice is remembered via extended attributes (xattr) on the directory, so subsequent edits auto-detect the configured path.

### XCS Bundle Support

For `.xcs` bundle directories, the xattr is stored on the bundle root, allowing all files within the bundle to share the same RCS configuration.

## Requirements

- Bun or Node.js 18+
- RCS tools installed (`brew install rcs`)
- (Optional) `claude` CLI for AI-generated commit messages

## History

- Original Perl version by Dave Regan (regan@ao.com) - May 2000
- Modified by Casey Manion (casey@manion.com) - Nov 2005
- JavaScript port - Jan 2026
