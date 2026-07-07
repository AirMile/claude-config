# STATE-SYNC-PUSH — preflight, push procedure & auto-push

Self-contained push path of the state-branch sync. Pull, clone-restore, conflict
handling and the invariants live in `shared/STATE-SYNC.md`.

## Branch resolution (non-interactive)

Resolve the state branch via `git ls-remote` discovery precedence as defined in
`shared/STATE-SYNC.md § 2`. Auto-push never prompts: if resolution is ambiguous or
the team guard would fire, skip the push and report instead (§ Auto-push, non-fatal).

## Preflight & temp-worktree hygiene

Runs before every push/pull. All of state sync happens on the **main checkout** only —
worktree `.project/` is symlinks back to main (`shared/WORKTREE.md`), so a state op
from inside a worktree would double-resolve.

```bash
main_root=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
current_root=$(git rev-parse --show-toplevel)
# current_root != main_root  → NOT the main checkout: exit with the ExitWorktree hint
STATE_WT="$main_root/.project/tmp/state-sync"   # path defined once — no git verb on this line
STATE_BRANCH="claude/state"                      # or the resolved per-dev branch (§ 2)

cd "$main_root" && git worktree prune
git worktree remove --force "$STATE_WT" 2>/dev/null || true   # dangling worktree from a crashed run
rm -rf "$STATE_WT"
```

Also require a remote (`git remote` non-empty) — without one, state sync exits
(`/project-sync`) or silently skips (auto-push).

> **Linter note.** `scripts/check-no-project-commit.py` flags `git add` / `git commit`
> only when a literal `.project/` appears **on the same line**. Keep the `.project/`
> path in the `$STATE_WT` variable (defined on its own line, no git verb) and reference
> only `"$STATE_WT"` on every `git add` / `git commit` line — no allow-marker needed.

## Push procedure

Bash (macOS / Linux) — assumes Preflight already ran (`main_root`, `STATE_WT`,
`STATE_BRANCH` set, hygiene done):

```bash
if git fetch origin "$STATE_BRANCH" 2>/dev/null && \
   git rev-parse "refs/remotes/origin/$STATE_BRANCH" >/dev/null 2>&1; then
  git worktree add --detach "$STATE_WT" "origin/$STATE_BRANCH"
  ( cd "$STATE_WT" && git rm -rq . 2>/dev/null || true )   # so deletions propagate
else
  # first-time: no remote branch yet → orphan
  git worktree add --detach "$STATE_WT" HEAD
  ( cd "$STATE_WT" && { git switch --orphan state-sync-tmp 2>/dev/null || git checkout --orphan state-sync-tmp; git rm -rq . 2>/dev/null || true; } )
fi

python3 "$main_root/.claude/skills/project-sync/scripts/state-files.py" collect --project "$main_root" --dest "$STATE_WT"

cd "$STATE_WT" && git add -A
if git diff --cached --quiet; then
  echo "STATE: no changes since last sync"
  NEW_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
else
  git commit -q -m "state: sync from $(hostname) $(date -u +%Y-%m-%dT%H:%MZ)"
  git push origin "HEAD:refs/heads/$STATE_BRANCH"
  NEW_SHA=$(git rev-parse HEAD)
fi

cd "$main_root"
git worktree remove --force "$STATE_WT"
git branch -D state-sync-tmp 2>/dev/null || true
# then write state-sync.json: branch=$STATE_BRANCH, lastSyncedSha=$NEW_SHA, lastPushAt=<utc>
```

**Windows (PowerShell)** — identical git commands; repo rule: `cd "<path>"; git …`
(never `git -C` with backslashes). Differences: `Set-Location`;
`$main_root = (git worktree list --porcelain | Select-Object -First 1) -replace '^worktree '`;
`python` if `python3` is absent; `$(hostname)` → `$env:COMPUTERNAME`;
timestamp `Get-Date -AsUTC -Format yyyy-MM-ddTHH:mmZ`.

**Push rejected** (non-fast-forward — another device pushed between fetch and push):
re-run Preflight hygiene, re-fetch, rebuild the worktree from the new `origin/$STATE_BRANCH`
tip, re-`collect`, retry the push **once**. On a second failure: report and suggest
`/project-sync pull` to reconcile first.

## Auto-push

Run § Push procedure **non-interactively and non-fatally**:

- Solo project → may bootstrap `claude/state` silently.
- Team project with no branch configured → skip with the one-line hint from
  `shared/STATE-SYNC.md § 2` (never prompt inside a ship flow).
- Any failure (no remote, push rejected twice, network) → print one hint line and
  **return control to the caller**. Auto-push must never block or fail a ship/finalize.

Report line for the caller's output table:
`State: pushed {branch}@{shortsha} | no changes | skipped ({reason}) | failed ({reason})`.
