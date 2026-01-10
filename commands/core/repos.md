---
description: List local repos sorted by recent activity, select by number to open in VS Code
---

# Repos

Lists all git repositories in the configured folder, sorted by most recent commit. User selects by number to open in VS Code.

## Configuration

Default scan folder: `/c/Projects` (Windows: `C:\Projects`)

## Process

### Step 1: Find Git Repos

List all directories containing `.git`:

```bash
ls -d /c/Projects/*/ 2>/dev/null | while read dir; do
  if [ -d "${dir}.git" ]; then
    basename "$dir"
  fi
done
```

### Step 2: Get Last Commit Dates

For each repo found, get the Unix timestamp and human-readable date:

```bash
git -C "/c/Projects/<repo>" log -1 --format="%ct|<repo>|%ai"
```

Collect all results and sort by timestamp (descending = most recent first).

### Step 3: Display Numbered List

Present results with relative time in Dutch:

```
REPOSITORIES (recent → old):

 1. elemental-clash       (gisteren)
 2. claude-config         (3 dagen geleden)
 3. stories               (1 week geleden)
 ...
```

Calculate relative time:
- < 1 day: "vandaag" or "X uur geleden"
- 1 day: "gisteren"
- 2-6 days: "X dagen geleden"
- 1-4 weeks: "X weken geleden" or "1 week geleden"
- 1-11 months: "X maanden geleden" or "1 maand geleden"
- 12+ months: "1 jaar geleden" or "X jaar geleden"

### Step 4: User Selection

After showing the list, wait for user to type a number.

Do NOT use AskUserQuestion - just wait for direct number input.

### Step 5: Open in VS Code

When user provides a number, execute:

```bash
code "C:\Projects\<selected-repo>"
```

Confirm:
```
Opening <repo-name> in VS Code...
```
