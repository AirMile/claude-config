# PHASE 6: Scoped Commit

Load this file when entering PHASE 6. Contains the full scoped auto-commit flow.

---

Follow [shared/SCOPED-COMMIT.md](../../shared/SCOPED-COMMIT.md). game-build deltas:

- **Baseline**: status form — `.project/session/pre-skill-status.txt`.
- **Diagnostics**: gdlint on changed `.gd` files (skip silently if `gdlint` unavailable or no `.gd` changes): `timeout 60 gdlint $(git diff --name-only $(cat .project/session/pre-skill-status.txt) 2>/dev/null | grep '\.gd$') 2>&1` — FAIL → show errors (max 30 lines) + "Fix first (Recommended)" / "Commit anyway" (`[diagnostics-warnings]` tag).
- **OVERLAP policy**: interactive.
- **Fallback**: `git add -A`.
- **Commit**: `git commit -m "build({feature}): {n} requirements ({tdd} TDD, {only} impl-only)"`
- **Cleanup**: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation Only ({n})
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
