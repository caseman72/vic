---
name: push
description: Update README, commit changes, and push to origin
disable-model-invocation: true
allowed-tools: Read, Edit, Bash, Glob, Grep
---

# Push Changes

Pre-computed git info:

```
$(git status --short)
```

Diff stats:
```
$(git diff --stat)
$(git diff --cached --stat)
```

Recent commits for style reference:
```
$(git log --oneline -5)
```

## Instructions

1. Review the changes shown above
2. If README.md needs updating based on the changes (new features, flags, syntax checkers, etc.), update it
3. Stage all changes: `git add -A`
4. Create a commit with a clear, concise message summarizing what changed
5. Push to origin: `git push`

Always include in commit messages:
```
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
