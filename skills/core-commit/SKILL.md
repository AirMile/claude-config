---
name: core-commit
description: Generate conventional commit messages from staged diffs. Use with /core-commit.
reads: [feature.externalRef, team.commitConvention, team.ticketPrefix]
writes: [team.commitConvention, team.ticketPrefix]
metadata:
  author: claude-config
  version: 1.6.0
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
   - No `.project/project.json` present (e.g. this tool's own meta-repo) → skip caching; detect convention fresh each session from `git log` only.

2. **externalRef detect** (per commit, unless not applicable):
   - No `.project/features/` directory at all → not applicable, skip step 2 silently.
   - Otherwise read `.project/features/<branch-or-feature-name>/feature.json` → check
     `externalRef`:
     - `type === "github"` → prefix suggestion: `(#{id})` as suffix
     - `type === "jira"` or `"linear"` → prefix suggestion: `{id}: ` as prefix
   - No feature.json → check branch name against `[A-Z]+-\d+` regex → use as prefix suggestion

3. **Compose integration** (step 4 below): use detected convention + externalRef when generating the commit message. Conservative: show the suggestion, user confirms before commit.

### 2. Stage Changes (if needed)

**Before asking to stage anything**: run Step 3's Mixed concerns detection against the
unstaged diff. If it triggers the multi-commit-split path, skip straight to
`references/multi-commit-split.md` — staging happens per-commit inside that flow, never via
the blanket ask below.

If there are unstaged changes but nothing staged, and no split was triggered:

- Show an overview of unstaged files

> **Todo**: Read `.claude/skills/core-commit/references/staging-safety.md` and apply its
> blocklist, warnings, and `.gitignore` coverage check before staging.

- Ask: "Stage all changes?" (with AskUserQuestion) — "Yes (Recommended)" / "No"
- If yes: `git add -A`

### 3. Analyze Changes

Analyze the diff for:

**Type** (Conventional Commits):

| Type       | Use                        | SemVer |
| ---------- | -------------------------- | ------ |
| `feat`     | New feature                | MINOR  |
| `fix`      | Bug fix                    | PATCH  |
| `docs`     | Documentation only         | -      |
| `style`    | Formatting, whitespace     | -      |
| `refactor` | Code refactoring           | -      |
| `perf`     | Performance improvement    | PATCH  |
| `test`     | Adding/fixing tests        | -      |
| `build`    | Build system, dependencies | -      |
| `ci`       | CI/CD configuration        | -      |
| `chore`    | Other tasks                | -      |
| `revert`   | Revert previous commit     | -      |

**Scope**: Component/module name (optional)
**Breaking change**: Add ! after type for breaking changes

**Mixed concerns detection:**
If staged changes contain multiple unrelated groups:

- Detect based on path pattern (e.g. `.claude/` vs `src/` vs `public/`)
- Detect based on type (deletions-only group vs additions group)
- 2 clearly separated groups → Suggest split via AskUserQuestion:
  - "Split into separate commits (Recommended)" → unstage the secondary group, commit primary first
  - "One commit" → proceed with everything
- **>2 groups, or a shared file (README, CHANGELOG, a config/registry doc) touched by more than
  one concern** → read `references/multi-commit-split.md` before staging anything — do not
  improvise a split by hand.

### 4. Generate Message

**Convention integration** — apply the convention § 1.5 detected before shaping the header:

- `conventional`, or nothing detected → the format below, unchanged.
- `ticket-prefix` → `{ticketPrefix}-{number}: <description>`. Take the number from the
  externalRef, else from the branch name's `[A-Z]+-\d+` match. Neither available → fall back to
  `conventional` and say so in the confirm step.
- `bracket` → `[{TAG}] <description>`, tag taken from the dominant tag in `git log`.
- `freeform` → an imperative one-line subject, no type/scope grammar.

The header limit, the English rule, and the no-emoji rule below apply to **every** convention;
only the header's shape changes. A detected `externalRef` adds its own affix per § 1.5 step 2 on
top of the shape chosen here.

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
- **Language: English** — commit messages are always written in English regardless of the project's runtime language setting. Commit messages are not a runtime-output category and are not translated (see `skills/shared/LANGUAGE.md`).
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

Show the generated message and ask for confirmation (AskUserQuestion):

- "Commit (Recommended)" → execute commit
- "Edit" → allow user to modify
- "Cancel" → cancel

> **STOP — before every `git commit` call, including every commit in a multi-commit split.** Do
> not call `git commit` until this gate returned "Commit" for _this specific_ message. A
> multi-commit session does not carry one approval across commits — each commit gets its own
> gate — **except when "Auto-commit all" gating was chosen** (`multi-commit-split.md § 1`): one
> upfront approval of the full numbered commit list covers the whole split; do not re-ask per
> commit.

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

> **STOP — for a single commit, ask this after it succeeds.** For a multi-commit split, ask
> **once**, after the last commit in the split — never per-commit (this applies regardless of
> which Step 5 gating mode was chosen). Do not silently end the turn without this gate.

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
