---
name: core-commit
description: Generate conventional commit messages from staged diffs. Use with /core-commit.
reads: [feature.externalRef, team.commitConvention, team.ticketPrefix]
writes: [team.commitConvention, team.ticketPrefix]
metadata:
  author: claude-config
  version: 1.14.0
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
- `git diff --cached --stat` - size and shape of the change (or `git diff --stat` if nothing
  staged)

**Do not read the full diff yet.** § 2's routing test runs on the stat alone, and it decides who
owns the read: a split routes to `multi-commit-split.md § 0`, which freezes the diff to a file and
reads it there. Reading it here as well duplicates that read — on a real split changeset that is
tens of thousands of tokens for nothing (`SKILL-PATTERNS.md § Token Efficiency`, item 4).

Once § 2 routes to the 1-group or 2-group path, read the full diff (`git diff --cached`, or
`git diff`) **only when the stat totals stay under ~1500 changed lines**. At or above that, keep it
out of this thread and classify from the stat plus targeted reads of the files whose message you
cannot write without them.

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
ls .git/rebase-merge .git/rebase-apply \
   .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null
```

### 1.5. Convention + Ticket Detection

Steps 1–2 run once per project. Skip both if `team.commitConvention` is already set, or — in a
repo without `.project/project.json` — if `.git/core-commit-convention` exists; read the cached
value from whichever is present.

Neither cache invalidates on its own. The user saying the repo's convention changed (or a cached
value that contradicts what `git log` now shows) is the signal to delete
`.git/core-commit-convention` / clear `team.commitConvention` and re-run step 1.

1. **Convention detect**: count matches over the last 20 subjects — do not eyeball the list.
   Run the count, read the winner off it (>60% = 13+ of 20; no pattern reaches it → `freeform`):

   ```bash
   S=$(git log --pretty=%s -20)
   for p in '^[a-z]+(\([a-z-]+\))?: ' '^[A-Z]+-[0-9]+[: ]' '^\[[A-Z-]+\]'
   do
     printf '%s  %s\n' "$(printf '%s\n' "$S" | grep -cE "$p")" "$p"
   done
   ```

   `--pretty=%s` and not `--oneline`: the patterns are anchored at `^`, which never matches past
   `--oneline`'s sha prefix (and POSIX ERE has no `\d`).
   - `^[a-z]+(\([a-z-]+\))?: ` → `"conventional"` (Conventional Commits)
   - `^[A-Z]+-\d+[: ]` → `"ticket-prefix"` (Jira/Linear style)
   - `^\[[A-Z-]+\]` → `"bracket"` (bracket-tag style)
   - Otherwise → `"freeform"`

2. **Cache the result** — this is the skill's declared `writes:`, so it is a step, not an
   afterthought. Write the detected value now, before composing anything:

   ```bash
   PJ=.project/project.json
   jq '.team.commitConvention = "<detected>"' "$PJ" > "$PJ.tmp" \
     && mv "$PJ.tmp" "$PJ"
   ```

   For `ticket-prefix`, extract the prefix (e.g. `"JIRA"`) into `.team.ticketPrefix` in the same
   write.

   No `.project/project.json` (e.g. this tool's own meta-repo) → cache inside `.git` instead, so
   detection stays a once-per-repo cost rather than a once-per-session one. Same two values, one
   line each:

   ```bash
   printf '%s\n' "<detected>" "<ticketPrefix or ->" \
     > "$(git rev-parse --git-dir)/core-commit-convention"
   ```

3. **externalRef detect** (per commit, unless not applicable):
   - No `.project/features/` directory at all → not applicable, skip step 3 silently.
   - On a trunk branch (`main`/`master`) no feature matches and the name carries no ticket, so
     both lookups below are empty by construction → no externalRef, continue to step 4.
   - Otherwise read `.project/features/{feature-name}/feature.json` (the feature matching the
     current branch) → check `externalRef`:
     - `type === "github"` → prefix suggestion: `(#{id})` as suffix
     - `type === "jira"` or `"linear"` → prefix suggestion: `{id}: ` as prefix
   - No feature.json, or no feature matching the current branch → check the branch name against
     `[A-Z]+-\d+` and use a match as prefix suggestion; no match either → no externalRef,
     continue without a prefix

4. **Compose integration**: hand the detected convention + externalRef to § 4 (Generate Message).
   Conservative: show the suggestion, user confirms before commit.

### 2. Detect Mixed Concerns, Then Stage

**Detect first** — the split path stages per commit, so a blanket `git add -A` would have to be
undone. Run this against whatever diff you have (unstaged, or staged if something already is):

Group from `git diff --stat` / `--name-only` — by path pattern (`.claude/` vs `src/` vs `public/`)
and by type (deletions-only vs additions). **Do not read full diffs here**: a split routes to § 0's
inventory, which reads them once and owns the classification.

Paths only separate concerns that live in different directories. A single concern spanning a
manifest, a util and its call sites reads as several groups; one file carrying two concerns reads
as one. **Ambiguous count → route to the split**: § 0 reads the diff and settles it, so arriving
there with one concern costs a granularity modal, while missing a third concern costs a rewritten
history.

> **Todo**: before anything is staged on any path below, Read
> `.claude/skills/core-commit/references/staging-safety.md` and apply its blocklist, warnings, and
> `.gitignore` coverage check. Every path runs these exactly once against the whole changeset —
> the ≥3-group path runs them at `multi-commit-split.md § 0` instead of here, since § 0 freezes the
> path set they check.

Then apply the routing test, in this order:

- **>2 groups, or any file touched by more than one group** (a shared narrative file — README,
  CHANGELOG, a config/registry doc — is the usual case) → read `references/multi-commit-split.md`
  and follow it from § 0. Do not improvise a split by hand, and stage nothing first: § 0 freezes
  the pre-split baseline its integrity gate depends on.
- **Exactly 2 groups, no file in both** → each commit takes whole files, so nothing can be
  hand-split and lost. Suggest the split inline via AskUserQuestion:
  - "Split into separate commits (Recommended)" → stage and commit group 1, then group 2
  - "One commit" → proceed with everything

  Two guards still apply on top of the staging-safety `> **Todo**` above, since this path skips
  the reference's § 3.5 and § 4: run the test suite (discovered as in `multi-commit-split.md § 4`)
  before the first commit, and after the last one confirm `git status --porcelain` prints nothing.
  Whole-file staging plus a clean tree is the completeness proof here — no baseline freeze needed.

- **1 group** → no split; continue to _Then stage_ below.

**Then stage**, only when there are unstaged changes, nothing staged, and no split was triggered:

- Show an overview of unstaged files
- Ask: "Stage all changes?" (with AskUserQuestion) — "Yes (Recommended)" / "No"
- If yes: `git add -A`

### 3. Analyze Changes

Analyze the diff for:

**Type** (Conventional Commits):

| Type       | Use                        |
| ---------- | -------------------------- |
| `feat`     | New feature                |
| `fix`      | Bug fix                    |
| `docs`     | Documentation only         |
| `style`    | Formatting, whitespace     |
| `refactor` | Code refactoring           |
| `perf`     | Performance improvement    |
| `test`     | Adding/fixing tests        |
| `build`    | Build system, dependencies |
| `ci`       | CI/CD configuration        |
| `chore`    | Other tasks                |
| `revert`   | Revert previous commit     |

**Scope**: Component/module name (optional)
**Breaking change**: Add ! after type for breaking changes

Mixed concerns were already detected and routed in Step 2 — by this point the changeset is either
one concern, or one commit of a split whose scope § 2 of `multi-commit-split.md` fixed.

### 4. Generate Message

**Convention integration** — apply the convention § 1.5 detected before shaping the header.
`conventional`, or nothing detected → the format below, unchanged; that is the common case.

> **Todo**: § 1.5 detected `ticket-prefix`, `bracket`, or `freeform` → Read
> `.claude/skills/core-commit/references/message-shapes.md` and shape the header per that file.
> Everything below still applies; only the header's shape differs.

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
- No upstream set → rerun as `git push --set-upstream origin <branch>`. This is the normal first
  push of a feature branch, not a failure: do the rerun, then report the push as succeeded and
  say the upstream was set.
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
