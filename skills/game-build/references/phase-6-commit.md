# PHASE 6: Scoped Commit

Load this file when entering PHASE 6. Contains the full scoped auto-commit flow.

---

**Step 0: Pre-commit gdlint check** (GDScript):

- Check if `gdlint` is available: `command -v gdlint`
- Not available → skip silently
- No `.gd` files changed → skip

If available: run on changed `.gd` files from this build:

```bash
timeout 60 gdlint $(git diff --name-only $(cat .project/session/pre-skill-status.txt) 2>/dev/null | grep '\.gd$') 2>&1
```

- **PASS** → show `DIAGNOSTICS: PASS`, continue to commit flow
- **FAIL** → show errors (max 30 lines) + AskUserQuestion:
  - `"Fix first (Recommended)"` — stop PHASE 6, no commit
  - `"Commit anyway"` — continue; add `[diagnostics-warnings]` to commit message

**Scoped auto-commit** (only this skill's changes):

Compare current git status with baseline from PHASE 0:

```bash
git status --porcelain | sort > /tmp/current-status.txt
```

Categorize files by comparing with `.project/session/pre-skill-status.txt`:

- **NEW** (only in current, not in baseline) → `git add` automatically
- **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
- **PRE-EXISTING** (only in baseline) → do NOT stage

If baseline file doesn't exist, fall back to `git add -A`.

```bash
git commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first, {only} impl-only)"
```

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count}

Next steps:
  1. /game-verify {feature} → playtest verification
  2. /game-debug → if there are unexpected failures
```

**Worktree reminder** — add one extra block to the output if the current branch matches the `worktree-*` pattern (`git branch --show-current`):

```
💡 Worktree active: {worktree_path}
   Next skills (/game-verify, /game-refactor, /game-debug) start in a NEW chat —
   they auto-detect this worktree and switch into it.
   For merge/cleanup: /core-finalize {feature}
```

> **Todo**: mark PHASE 6 → `completed`. All 10 phases must now be `completed`.
