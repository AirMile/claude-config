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

Alternative form — **SHA baseline** (skills that commit mid-run, e.g. dev-ship's build phase): store `git rev-parse HEAD` in `pre-skill-sha.txt`; at commit time derive changed files via `git diff --name-only $(cat pre-skill-sha.txt)` (+ `git ls-files --others --exclude-standard` for new files).

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

Staging itself happens via § 5's atomic script — never a bare `git add`.

**`.project/` is local-only**: `.project/` paths (feature.json, backlog.json, session files) are gitignored developer-local state — **never stage or commit them**. Stage only codebase files: source, tests, acceptance test files, repo config. Non-`.project/` paths: plain `git add`. A durable text subset may travel across your own devices via the orphan branch `claude/state` (`shared/STATE-SYNC.md`, `/project-sync`) — never via a working-branch commit.

**Fallback when baseline file is missing** (skill picks one): `git add -A` (default — safe because gitignored dirs stay out; setup skills guarantee `.gitignore` covers these) · stage only known codebase skill-output files · ask the user which files belong to the change.

## 3. Pre-commit diagnostics (optional, before staging)

Stack-aware lint/typecheck with **set-diff against the lint baseline** (`pre-skill-lint.txt` from PHASE 0): `new_errors = current_error_keys \ baseline_error_keys` (keys = `file:line:rule` — never numeric deltas; line shifts cause false positives). GDScript: `gdlint` on changed `.gd` files. On new errors → AskUserQuestion: "Fix now (Recommended)" (stop, no commit) / "Commit anyway" (append `[diagnostics-warnings]` to the message) / "Abort".

## 4. Worktree commit

When running inside a worktree (`current_root != main_root`), stage and commit app-code changes inside the worktree as normal. `.project/` is local-only state — its symlinks back to the main repo are updated in-place; no extra commit on main is needed.

## 5. Commit + cleanup

Never assume exclusive access to `.git/index` or the branch tip — another session (a parallel `/dev-tweak`, `/dev-ship`, or the user's own git client) may be committing to the same branch concurrently. Land via:

```bash
bash ~/.claude/scripts/scoped-commit.sh --message <path-to-message-file> --files <NEW + approved-OVERLAP, comma-separated>
```

This builds the commit in an isolated index and lands it with a compare-and-swap `git update-ref` — concurrent commits on the same branch serialize instead of corrupting each other (see the script's header for the two failure modes this replaces). It also bypasses the repo's commit hooks (`commit-tree`/`update-ref` don't invoke them) — intentional, not a corner cut: § 3's diagnostics (or the calling skill's own verify step) already ran against this exact file set before staging, so the hook would only re-check the same thing while widening the race window.

Guard: skip the call when the diff vs baseline is empty and nothing is staged (exit 4 from the script confirms this — treat it as a no-op, not an error).

**Mixed-content OVERLAP fallback**: if a file's current dirty content mixes this skill's change with another session's (rare — e.g. two unrelated i18n-key edits in the same registry file), the script's whole-file staging isn't safe. Stage only your hunks manually instead: `git diff HEAD -- <file> > /tmp/mine.patch`, then apply it inside an isolated index the same way the script does (`GIT_INDEX_FILE=<tmp> git read-tree HEAD && GIT_INDEX_FILE=<tmp> git apply --cached /tmp/mine.patch`) before folding that file into the same `write-tree`/`commit-tree`/`update-ref` sequence.

**Recovery rule — never move a branch ref from memory.** If a mistake needs undoing (wrong files landed, wrong message), re-read `git log --oneline -3` and `git rev-parse HEAD` FIRST and act only on what's actually there — never assume the tip you saw a command or two ago is still the tip. Never `git reset --soft/--hard HEAD^`/`HEAD~N` on a shared branch as a corrective move — if a bad commit needs removing, use `git update-ref <ref> <known-good-sha> <current-tip>` (the same CAS the script uses) so an unrelated commit that landed in between fails the swap instead of silently vanishing from the branch.

Then remove the skill's session files (baseline file(s), lint baseline, `active-{feature}.json`, temp status files).
