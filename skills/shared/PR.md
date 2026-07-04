# Shared PR Creation Flow

Single source of truth for `gh pr create` in the claude-config pipeline. Used by `core-finalize` and the optional PR offer at the end of `dev-ship (refactor phase)`, `game-ship (refactor phase)`, `design-check`.

## Detection

Run first. Callers use the result to decide whether to show the PR option at all.

```bash
# macOS / Linux
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
GH_AVAILABLE=$?   # 0 = available + authenticated, non-zero = not available
```

```powershell
# Windows
$ghAvailable = (Get-Command gh -ErrorAction SilentlyContinue) -and (gh auth status 2>$null; $LASTEXITCODE -eq 0)
```

`core-finalize` uses `GH_AVAILABLE` to decide whether to show "Push + open PR" in its strategy list. The refactor/verify PR offer uses it as precondition check #3.

## Existing PR Handling

Run before `gh pr create` whenever `GH_AVAILABLE` is true. Callers pass `{source-branch}` (the worktree branch or current branch).

```bash
gh pr list --head {source-branch} --state all --json number,url,state --limit 1
```

| State         | Action                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OPEN**      | AskUserQuestion — header: "Existing PR" — question: "PR #{n} already exists ({url}). What do you want to do?" — options: "Show PR URL and exit (Recommended)" / "Update PR (push extra commits, no new PR)" / "Force new PR (closes existing)" / "Cancel" |
| **MERGED**    | Auto-route to cleanup-only: set `strategy = "cleanup-only"`, `pr_url = {url}`. Skip to caller's cleanup phase.                                                                                                                                            |
| **CLOSED**    | AskUserQuestion — "PR #{n} is closed. Create new one?" — "Yes, create new PR (Recommended)" / "Cancel"                                                                                                                                                    |
| **No result** | Continue to `gh pr create` below.                                                                                                                                                                                                                         |

## Preconditions (for the refactor/check PR offer)

When called from `dev-ship (refactor phase)`, `game-ship (refactor phase)`, `design-check` — all must hold. If any fails → fall through to caller's worktree-integration hint.

| Check                    | Command                                                      | Fail behaviour        |
| ------------------------ | ------------------------------------------------------------ | --------------------- |
| `gh` available + authed  | See Detection above (`GH_AVAILABLE == 0`)                    | fall through silently |
| On a `worktree-*` branch | `git branch --show-current \| grep -q '^worktree-'`          | fall through silently |
| `team.mode === "team"`   | Read via `shared/PROJECT-MODE.md` read pattern (`TEAM_MODE`) | fall through silently |
| Clean working tree       | `git status --porcelain` returns empty                       | fall through silently |

## Title Composition

Walk back through commits on the branch looking for a `build({feature}):` subject line:

```bash
TITLE=$(git log origin/{target}..HEAD --format='%s' | grep -m1 '^build({feature}):')
```

If found: derive title as `feat({feature}): {description}` where `{description}` is everything after `build({feature}): `.

If not found (e.g. skill ran only verify/refactor, no build commit): use the first commit on the branch:

```bash
TITLE=$(git log origin/{target}..HEAD --oneline | tail -1 | sed 's/^[a-f0-9]* //')
```

Fallback if both empty: `feat({feature}): merge worktree-{feature}`.

## Body Composition

```
## Summary
{bullet list of all commit subjects on branch, oldest to newest}

## Test plan
- [ ] Review changes
- [ ] CI passes
```

Get commit subjects:

```bash
git log origin/{target}..HEAD --format='- %s' --reverse
```

## The gh pr create Command

### macOS / Linux (bash/zsh)

```bash
gh pr create \
  --base {target} \
  --head worktree-{feature} \
  --title "{title}" \
  --body "$(cat <<'EOF'
{body}
EOF
)"
```

### Windows (PowerShell)

```powershell
$body = @"
{body}
"@
gh pr create --base {target} --head worktree-{feature} --title "{title}" --body $body
```

Capture the PR URL from stdout.

## Existing PR Handling

Before running `gh pr create`, always check:

```bash
gh pr list --head worktree-{feature} --state all --json number,url,state --limit 1
```

- **OPEN**: show URL, ask: "PR already open — show URL and exit? / Force new PR?" Default: show URL + exit.
- **MERGED**: print "Already merged as {url}." Exit.
- **CLOSED**: ask: "PR #{n} was closed. Create new one?" Default: yes.
- **No result**: proceed with `gh pr create`.

## Failure Handling

| Error                             | Action                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `gh auth status` fails            | Print "gh not authenticated — run `gh auth login` first." Fall through to caller's hint. |
| `git push` fails (e.g. no remote) | Print push error. Fall through to caller's hint.                                         |
| `gh pr create` fails              | Print full error. Fall through to caller's hint.                                         |

Never exit the parent skill on PR failure — the commit already happened; the worktree is intact.

## After PR Creation

- Print the PR URL.
- Do NOT clean up the worktree (PR must be reviewed first; cleanup happens in `/core-finalize` after merge).
- The caller's worktree-integration hint is suppressed (PR was opened; the hint is redundant).
