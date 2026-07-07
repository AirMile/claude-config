# State Sync — durable `.project/` across devices

Single source of truth for syncing the durable subset of a project's gitignored
`.project/` folder across a developer's own machines, via an **orphan branch**
`claude/state` in the same repo. All integration points (`/project-sync`,
`project-add` clone restore, `core-pull` staleness check, ship/finalize auto-push)
reference the sections here — never duplicate the procedure. The self-contained
push path (preflight, push procedure, auto-push) lives in `shared/STATE-SYNC-PUSH.md`.

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

Moved to `shared/STATE-SYNC-PUSH.md § Preflight & temp-worktree hygiene`.

## 6. Push procedure

Moved to `shared/STATE-SYNC-PUSH.md § Push procedure`.

## 7. Pull procedure & conflict matrix

Pragmatic, solo-dev-first (devices are mostly used sequentially). Assumes `shared/STATE-SYNC-PUSH.md § Preflight & temp-worktree hygiene` ran.

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

Moved to `shared/STATE-SYNC-PUSH.md § Auto-push`.

## 9. Clone restore (called by project-add clone mode)

After a fresh clone, before writing the setup marker:

```bash
# discovery per § 2
git ls-remote --heads origin "claude/state*"
```

If a branch matches: run `shared/STATE-SYNC-PUSH.md § Preflight & temp-worktree hygiene`, `git worktree add --detach "$STATE_WT"
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
