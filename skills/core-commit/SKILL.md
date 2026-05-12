---
name: core-commit
description: Analyze staged git changes and generate conventional commit messages. Use with /core-commit. Detects rebase/merge state, validates changes, follows project conventions.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Commit

Analyze staged changes and generate a clear commit message.

## Trigger

`/core-commit` or `/core-commit [extra context]`

## Process

### 1. Pre-flight Checks

Run in parallel:

- `git status` - review staged/unstaged changes
- `git diff --cached` - review staged changes (or `git diff` if nothing staged)

**Stop conditions** (report and exit):

- No changes → "No changes to commit"
- Rebase in progress → "Rebase active, resolve first with `git rebase --continue` or `--abort`"
- Merge in progress → "Merge conflict active, resolve first"
- Cherry-pick in progress → "Cherry-pick active, resolve first"

**Platform note:**
Always use `cd "<project-root>" && git <command>` instead of `git -C <path>`.
The `-C` flag has known issues with Windows paths containing backslashes.

**Detect rebase/merge state:**

```bash
# Check for active operations
ls .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null
```

### 1.5. Convention + Ticket Detection

Once per project (cache in `project.json#team`). Skip if `team.commitConvention` is already set.

1. **Convention detect**: `git log --oneline -20` → regex-match dominant pattern (>60% of commits):
   - `^[a-z]+(\([a-z-]+\))?: ` → `"conventional"` (Conventional Commits)
   - `^[A-Z]+-\d+[: ]` → `"ticket-prefix"` (Jira/Linear style)
   - `^\[[A-Z-]+\]` → `"bracket"` (bracket-tag style)
   - Otherwise → `"freeform"`
   - Cache in `project.json#team.commitConvention`. For ticket-prefix: extract prefix (e.g. `"JIRA"`) → `project.json#team.ticketPrefix`.

2. **externalRef detect** (per commit, always):
   - Search `feature.json` for current branch → check `externalRef`:
     - `type === "github"` → prefix suggestion: `(#{id})` as suffix
     - `type === "jira"` or `"linear"` → prefix suggestion: `{id}: ` as prefix
   - No feature.json → check branch name against `[A-Z]+-\d+` regex → use as prefix suggestion

3. **Compose integration** (step 4 below): use detected convention + externalRef when generating the commit message. Conservative: show the suggestion, user confirms before commit.

### 2. Stage Changes (if needed)

If there are unstaged changes but nothing staged:

- Show an overview of unstaged files

**Automatically block staging of:**

```
# Secrets & credentials (NEVER stage)
.env, .env.*, *.env
credentials.json, secrets.json, secrets.yml
*.pem, *.key, *.pfx, *.p12, *.crt
.tfvars, .tfvars.json
config/secrets.yml
**/service-account*.json
```

**Warn for:**

- Large files (>1MB) → show file size
- New file types not yet in `.gitignore`
- Binary files → ask for confirmation

**Warn for tracking removals:**
If `.gitignore` changes cause files to be removed from tracking (`git rm --cached`):

- Show the number of files being removed from tracking
- Show the directories that are affected
- Ask for explicit confirmation via AskUserQuestion
- Suggest doing the tracking removal as a **separate commit** (e.g. `chore: remove X from git tracking`)

**Warn for deletion of critical files:**
If staged changes delete or remove from tracking any of the following files, show an explicit warning and ask for confirmation:

```
CLAUDE.md
.github/**
package.json, package-lock.json
tsconfig.json
vite.config.*, vitest.config.*
.gitignore
```

**`.gitignore` coverage check:**
Before staging, verify that risky file patterns are covered by `.gitignore`. This prevents accidental commits outside this skill (e.g. manual `git add -A`).

1. Read `.gitignore` (if it exists) and collect all patterns
2. Check if the following categories are covered — only flag patterns that are **both missing from `.gitignore` AND actually present** as files/directories in the working tree:

   **Secrets & credentials (from blocklist above):**

   ```
   .env, .env.*, *.key, *.pem, *.pfx, *.p12, *.crt
   credentials.json, secrets.json, secrets.yml
   .tfvars, *.tfvars.json
   **/service-account*.json
   ```

   **Build output:**

   ```
   dist/, build/, out/, .next/, .nuxt/, .output/
   ```

   **Dependencies:**

   ```
   node_modules/, vendor/, __pycache__/, .venv/, venv/
   ```

   **IDE/OS artifacts:**

   ```
   .idea/, .DS_Store, Thumbs.db
   ```

   **Logs:**

   ```
   *.log, npm-debug.log*
   ```

3. If missing patterns are found that match existing files/directories, show them grouped by category and ask via AskUserQuestion:
   - header: ".gitignore"
   - question: "These patterns are missing from .gitignore but exist in your working tree:\n\n[list per category]\n\nDo you want to add them?"
   - options:
     - "Add all (Recommended)" → append all missing patterns to `.gitignore`
     - "Let me pick" → show each pattern individually for yes/no
     - "Skip" → continue without changes
4. If patterns were added: stage the updated `.gitignore` file (`git add .gitignore`) so it's included in the commit

- Ask: "Stage all changes?" (with AskUserQuestion)
- If yes: `git add -A`

### 3. Analyze Changes

Analyze the diff for:

**Type** (Conventional Commits):
| Type | Use | SemVer |
|------|-----|--------|
| `feat` | New feature | MINOR |
| `fix` | Bug fix | PATCH |
| `docs` | Documentation only | - |
| `style` | Formatting, whitespace | - |
| `refactor` | Code refactoring | - |
| `perf` | Performance improvement | PATCH |
| `test` | Adding/fixing tests | - |
| `build` | Build system, dependencies | - |
| `ci` | CI/CD configuration | - |
| `chore` | Other tasks | - |
| `revert` | Revert previous commit | - |

**Scope**: Component/module name (optional)
**Breaking change**: Add ! after type for breaking changes

**Mixed concerns detection:**
If staged changes contain multiple unrelated groups:

- Detect based on path pattern (e.g. `.claude/` vs `src/` vs `public/`)
- Detect based on type (deletions-only group vs additions group)
- If >2 clearly separated groups or >50% of changes are unrelated to the primary change:
  - Suggest split via AskUserQuestion:
    - "Split into separate commits (Recommended)" → unstage the secondary group, commit primary first
    - "One commit" → proceed with everything

### 4. Generate Message

**Format (Conventional Commits 1.0.0):**

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

**Validation rules:**

- Header max **72 characters** (Git convention)
- Type: lowercase, from allowed list
- Subject: lowercase start, no trailing period, imperative mood ("add" not "added")
- Body: empty line after header, explain "why" not "what"
- Breaking change: use ! or BREAKING CHANGE: footer

**Examples:**

```
feat(auth): add OAuth2 login support

fix!: resolve race condition in request handling

docs: update API documentation for v2 endpoints
```

**Do not allow:**

- Emojis in commit messages
- Subject longer than 72 characters

### 5. Confirm & Commit

Show the generated message and ask for confirmation:

- "Commit" → execute commit
- "Edit" → allow user to modify
- "Cancel" → cancel

**Execute commit with HEREDOC** (safe for quotes and multilines):

```bash
git commit -m "$(cat <<'EOF'
<message>
EOF
)"
```

### 6. Error Handling

**Pre-commit hook failure:**

1. Show full error output
2. Ask user (AskUserQuestion):
   - "Fix issues" → fix the issue, **create NEW commit** (never amend on failure)
   - "Skip hooks" → `HUSKY=0 git commit ...` or `git commit --no-verify`
   - "Cancel" → cancel

**Hook bypass warning:**

```
⚠️ Hooks are being bypassed. This can cause CI failures.
```

**Other failures:**

- Empty commit → "No staged changes. Use `git add` first."
- Lock file exists → "Git is busy (.git/index.lock). Wait or remove the lock."

**On success:**

```bash
git log -1 --oneline
```

### 7. Push Option

After a successful commit, ask with AskUserQuestion:

- header: "Push"
- question: "Do you also want to push the changes immediately?"
- options:
  - "Push (Recommended)" → execute `git push`
  - "Skip" → done, show success output

**Push error handling:**

- No remote configured → show message, skip push
- Push rejected (behind remote) → suggest `git pull --rebase` first
- Auth failure → show error, suggest checking credentials

**Push success output:**

```
✅ Pushed to [remote]/[branch]
```

### 8. Amend Safety (ONLY if user asks)

**Only allow amend when ALL conditions are true:**

1. User explicitly asks for amend
2. Previous commit was made by you (check: `git log -1 --format='%an'`)
3. Commit has NOT been pushed to remote (check: `git status` shows "ahead")
4. It is NOT a recovery from a failed commit

**When in doubt:** Create a new commit, never amend.

## Output

**Success:**

```
✅ Committed: <type>(<scope>): <title>

   [hash] on branch [branch-name]
   [+X -Y files changed]
```

**Error:**

```
❌ Commit failed: <reason>

   💡 <suggested fix>
```

**Hook skipped:**

```
⚠️ Committed (hooks skipped): <type>(<scope>): <title>

   [hash] on branch [branch-name]
```
