# Scoped Commit Protocol

Single source of truth for the end-of-skill scoped auto-commit: commit ONLY this skill's changes, never pre-existing dirt. Skills reference this file and state only their deltas (baseline filename, OVERLAP policy, fallback, commit message, cleanup list).

---

## 1. Baseline (written in the skill's PHASE 0)

Default form — **status baseline**:

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/{baseline-file}.txt
```

`{baseline-file}` is per skill (e.g. `pre-skill-status`, `pre-debug-status`). Capture **after** any worktree switch so the baseline describes the tree the skill mutates.

Alternative form — **SHA baseline** (skills that commit mid-run, e.g. dev-build): store `git rev-parse HEAD` in `pre-skill-sha.txt`; at commit time derive changed files via `git diff --name-only $(cat pre-skill-sha.txt)` (+ `git ls-files --others --exclude-standard` for new files).

## 2. Categorize (at commit time)

Compare `git status --porcelain | sort` with the baseline:

| Category         | Definition                                          | Action                 |
| ---------------- | --------------------------------------------------- | ---------------------- |
| **NEW**          | only in current, not in baseline                    | stage                  |
| **OVERLAP**      | in both baseline AND current, touched by this skill | per skill policy below |
| **PRE-EXISTING** | only in baseline, or dirty but untouched by skill   | never stage            |

**OVERLAP policy** (skill picks one):

- **interactive** (default — build/verify/refactor/team flows): AskUserQuestion "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" → "Include (Recommended)" / "Skip".
- **auto-include** (debug flows — the fix is the point): stage without asking.

**`.project/` is local-only**: `.project/` paths (feature.json, backlog.json, session files) are gitignored developer-local state — **never stage or commit them**. Stage only codebase files: source, tests, acceptance test files, repo config. Non-`.project/` paths: plain `git add`.

**Fallback when baseline file is missing** (skill picks one): `git add -A` (default — safe only when `.project/` is in `.gitignore`, which the setup skills guarantee) · stage only known skill-output files · ask the user which files belong to the change.

## 3. Pre-commit diagnostics (optional, before staging)

Stack-aware lint/typecheck with **set-diff against the lint baseline** (`pre-skill-lint.txt` from PHASE 0): `new_errors = current_error_keys \ baseline_error_keys` (keys = `file:line:rule` — never numeric deltas; line shifts cause false positives). GDScript: `gdlint` on changed `.gd` files. On new errors → AskUserQuestion: "Fix now (Recommended)" (stop, no commit) / "Commit anyway" (append `[diagnostics-warnings]` to the message) / "Abort".

## 4. Worktree commit

When running inside a worktree (`current_root != main_root`), stage and commit app-code changes inside the worktree as normal. `.project/` is local-only state — its symlinks back to the main repo are updated in-place; no extra commit on main is needed.

## 5. Commit + cleanup

Commit with the skill's conventional message. Guard: skip the commit when the diff vs baseline is empty and nothing is staged. Then remove the skill's session files (baseline file(s), lint baseline, `active-{feature}.json`, temp status files).
