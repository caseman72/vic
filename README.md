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

# Multiple files
./vic.js file1.js file2.js
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
| `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.mts` | oxlint, biome, or eslint |
| `.html`, `.htm` | htmlhint |
| `.css`, `.scss`, `.less` | stylelint |
| `.json` | Built-in JSON.parse validation |
| `.php` | php -l |
| `.py` | python -m py_compile |
| `.rb` | ruby -c |
| `.pl` | perl -c |

## Requirements

- Node.js 18+
- RCS tools installed (`/opt/homebrew/bin/co`, `ci`, `rcs`, `rcsdiff`, `rlog`)
- (Optional) `claude` CLI for AI-generated commit messages

## History

- Original Perl version by Dave Regan (regan@ao.com) - May 2000
- Modified by Casey Manion (casey@manion.com) - Nov 2005
- JavaScript port - 2025
