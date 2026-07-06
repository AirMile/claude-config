# State Sync — durable `.project/` across devices

Single source of truth for syncing the durable subset of a project's gitignored
`.project/` folder across a developer's own machines, via an **orphan branch**
`claude/state` in the same repo. All integration points (`/project-sync`,
`project-add` clone restore, `core-pull` staleness check, ship/finalize auto-push)
reference the sections here — never duplicate the procedure.

## 1. Purpose & invariants

The problem: `.project/` (backlog, dashboard, seed, learnings, archive, feature
dossiers) is developer-local and gitignored (Model A). On a second machine a clone
gets only an empty scaffold; authored state is lost.

The fix: a durable **text-only** subset travels on an orphan branch, isolated from
main. Invariants that stay intact:

- **`.project/` remains gitignored on every working branch.** No working branch ever
  tracks `.project/`. Model A is untouched.
- **`claude/state` is never merged into main** and never checked out into the working
  tree — it is written/read only through a detached temp worktree.
- **Text only.** Binaries (screenshots, wireframes) and regenerables never travel.
- **Credentials never travel.** `auth-state.json` is on the hard denylist.

## 2. Branch resolution

Default branch name: **`claude/state`**.

**Team guard** — never silently publish personal state to a team remote. If
`project.json#team.mode == "team"` and no branch is recorded yet in
`.project/session/state-sync.json`, the **first interactive push** (`/project-sync
push`) resolves the branch via **AskUserQuestion**:

- `claude/state-{user}` — **(Recommended)** per-developer branch, invisible to teammates' state
- `claude/state` — shared branch, visible to the whole team
- Cancel — don't publish personal state

`{user}` = `git config user.name`, lowercased, every run of non-alphanumeric chars
collapsed to a single `-` (deterministic across devices). Persist the chosen branch in
`state-sync.json#branch` so it is never asked again.

**Discovery** (pull / clone / status, non-interactive): `git ls-remote --heads origin
"claude/state*"` → prefer exact `claude/state-{user}`, else `claude/state`, else none.

**Auto-push never prompts.** Solo projects (no `team.mode == "team"`) may silently
bootstrap `claude/state`. In a team project with no branch configured yet, auto-push
prints one hint line (`state auto-push skipped — run /project-sync push once to
configure the state branch`) and continues. Auto-push must never block its caller.

## 3. Sync manifest & denylist

Canonical implementation: `skills/project-sync/scripts/state-files.py` (`collect` /
`restore`). This table documents what it moves — do not re-encode the rules elsewhere.

| Travels (include-list)                                                     | Never travels (denylist)                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `project.json`, `project-context.json`, `backlog.json`                     | `session/` (device-local), `auth-state.json` (credentials)         |
| `project-seed.md`, `conventions.md`, `architecture.mmd` (if present)       | `previews/`, `tmp/`, `cache/`, `backlog.html`                      |
| `features/*/`: `feature.json`, `thinking.md`, `research.md`, `00-split.md` | `screenshots/`, `wireframes/` (binaries)                           |
| `archive/backlog-archive.json`, `archive/learnings-*.json`                 | `playwright-runs/`, `security/`, `optimize/` (regenerable reports) |
| `thinking/*.md`                                                            | `plans/`; per-feature `stryker-report.json` and other reports      |

The denylist is enforced in **both** directions (defense-in-depth), so a tampered
state branch can never restore a credential or ephemeral file.

## 4. Sync-state file

`.project/session/state-sync.json` (in `session/` → device-local, never synced itself):

```json
{
  "branch": "claude/state",
  "lastSyncedSha": "<sha>",
  "lastPushAt": "<utc>",
  "lastPullAt": "<utc>"
}
```

`lastSyncedSha` is the `claude/state` commit this device last pushed or pulled — the
anchor for drift detection in § 7.

## 5. Preflight & temp-worktree hygiene

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

## 6. Push procedure

Bash (macOS / Linux) — assumes § 5 already ran (`main_root`, `STATE_WT`,
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
re-run § 5 hygiene, re-fetch, rebuild the worktree from the new `origin/$STATE_BRANCH`
tip, re-`collect`, retry the push **once**. On a second failure: report and suggest
`/project-sync pull` to reconcile first.

## 7. Pull procedure & conflict matrix

Pragmatic, solo-dev-first (devices are mostly used sequentially). Assumes § 5 ran.

```bash
git fetch origin "$STATE_BRANCH"
REMOTE_SHA=$(git rev-parse "refs/remotes/origin/$STATE_BRANCH")
LAST=<state-sync.json#lastSyncedSha, or empty>
```

| Situation                                         | Action                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `REMOTE_SHA == LAST`                              | Up to date — exit.                                                                    |
| `LAST` empty, local `.project/` is scaffold-empty | Plain **restore** of `REMOTE_SHA` (this is effectively a first pull / clone restore). |
| `LAST` empty, local `.project/` has content       | Treat every overlapping file as a conflict (see conflict rows).                       |
| `LAST` set, **local unchanged** since `LAST`      | **Fast-forward**: restore `REMOTE_SHA` over local, stamp `lastSyncedSha=REMOTE_SHA`.  |
| `LAST` set, **both changed**                      | Per-file resolution (below).                                                          |

**Local-drift check** (distinguishes the last two rows): worktree at `LAST`, `collect`
current `.project/` into it, `git status --porcelain` — empty ⇒ local unchanged.

**Both-changed, per file:** locally-changed set = the porcelain output above;
remotely-changed set = `git diff --name-only "$LAST" "$REMOTE_SHA"`. Then:

- remote-only file → take remote.
- local-only file → keep local (the next push carries it).
- in both (true conflict):
  - `backlog.json` / `archive/backlog-archive.json` → merge per feature `id`, newest
    `updated` timestamp wins per entry (small files, done inline).
  - other JSON with a top-level `updated` / `syncedAt` → newest wins.
  - `.md` files → **AskUserQuestion** per file: "Keep {newer side} (Recommended)" /
    "Take {other side}" / "Show diff first".

After applying, stamp `lastSyncedSha=REMOTE_SHA`, `lastPullAt=<utc>`, remove the temp
worktree(s). If the merge produced local-only changes, a follow-up `/project-sync push`
carries them back.

## 8. Auto-push (called by ship pipelines & finalize)

Run § 6 (Push) **non-interactively and non-fatally**:

- Solo project → may bootstrap `claude/state` silently.
- Team project with no branch configured → skip with the one-line hint from § 2
  (never prompt inside a ship flow).
- Any failure (no remote, push rejected twice, network) → print one hint line and
  **return control to the caller**. Auto-push must never block or fail a ship/finalize.

Report line for the caller's output table:
`State: pushed {branch}@{shortsha} | no changes | skipped ({reason}) | failed ({reason})`.

## 9. Clone restore (called by project-add clone mode)

After a fresh clone, before writing the setup marker:

```bash
# discovery per § 2
git ls-remote --heads origin "claude/state*"
```

If a branch matches: run § 5 hygiene, `git worktree add --detach "$STATE_WT"
"origin/$branch"`, `state-files.py restore --src "$STATE_WT" --project "$main_root"`,
remove the worktree, and write `.project/session/state-sync.json`
(`branch`, `lastSyncedSha=<remote sha>`, `lastPullAt=<utc>`). If none: skip silently
(scaffold-only clone, unchanged behavior).

## 10. Edge cases

| Case                                               | Handling                                                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First push, no `origin/claude/state`               | Orphan via `git switch --orphan state-sync-tmp` (fallback `git checkout --orphan`) in the temp worktree; push `HEAD:refs/heads/$STATE_BRANCH`; delete the temp local branch. |
| No remote at all                                   | `/project-sync` exits with "state sync requires a remote"; auto-push skips silently.                                                                                         |
| Dangling temp worktree (crashed prior run)         | § 5 hygiene: `git worktree prune` + `git worktree remove --force` + `rm -rf "$STATE_WT"`.                                                                                    |
| State branch diverged from `lastSyncedSha`         | § 7 conflict matrix (fast-forward / newest-wins / AskUserQuestion).                                                                                                          |
| Push rejected (race with other device)             | § 6: re-fetch, rebuild worktree from new tip, re-collect, retry once, then report.                                                                                           |
| Team remote                                        | § 2 team guard — never silently publish; first interactive push prompts for the per-dev branch.                                                                              |
| `state-sync.json` missing but remote branch exists | Treat as first pull on this device (§ 7 rows for empty `LAST`).                                                                                                              |
| Run from inside a worktree                         | § 5 gate exits — worktree `.project/` is symlinks; run on the main checkout.                                                                                                 |
| Not on the main checkout during `core-pull`        | core-pull's own `is_main_checkout` gate already exits before the state-sync step is reached.                                                                                 |
