# FINALIZE-REFERENCE — offer decision, report templates & failure modes

On-demand companion to `shared/FINALIZE.md` (which keeps the executable merge/cleanup flow).

## Finalize Offer Decision

Skills that opportunistically offer finalize (`design-ship`) consult this matrix to decide whether/how to prompt the user. Differs from the Detection matrix in `shared/FINALIZE.md`: this is about **whether we ask**, not about **what finalize executes**.

> **Note:** `dev-ship` / `game-ship` PHASE 4 finalize (after refactor) does not use this offer matrix — it uses an inline auto-dispatch (see their own `references/dev-verify/references/finalize.md` / `references/game-verify/references/completion-finalize.md` action tables). The matrix below is for the last step of the pipeline only.

Read `TEAM_MODE` + detect PR state:

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

Dispatch:

| TEAM_MODE | PR_STATE                 | Action                                                                                                                                                                    |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                                                    |
| solo      | `MERGED`                 | AskUserQuestion cleanup ("Cleanup now? Remove worktree + branch.") → `FINALIZE.md` mode `cleanup-only`.                                                                   |
| solo      | empty / `CLOSED` / no-gh | AskUserQuestion finalize ("Finalize now — merge to main + cleanup?") → `FINALIZE.md` mode `solo`.                                                                         |
| team      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                                                    |
| team      | `MERGED`                 | AskUserQuestion cleanup → `FINALIZE.md` mode `cleanup-only`.                                                                                                              |
| team      | empty / `CLOSED`         | AskUserQuestion 3-way: "Open PR (Recommended)" → `shared/PR.md`; "Merge directly to main (no PR)" → `FINALIZE.md` mode `solo`; "Keep open" → print `/core-finalize`-hint. |
| team      | no-gh                    | AskUserQuestion 2-way: "Merge directly to main (no PR)" → `FINALIZE.md` mode `solo`; "Keep open" → print `/core-finalize`-hint.                                           |

On "Keep open" → print `💡 Run /core-finalize {feature-name} when ready`.

**Team + empty/`CLOSED` — 3-way modal:**

```yaml
header: "Finalize"
question: "Feature '{feature-name}' verified. How do you want to finalize?"
options:
  - label: "Open PR (Recommended)"
    description: "Push the branch and open a PR via gh for review. Worktree stays until merged."
  - label: "Merge directly to main (no PR)"
    description: "Merge locally to main + cleanup worktree (same as solo mode)."
  - label: "Keep open"
    description: "Worktree stays open. Run /core-finalize {feature-name} when ready."
multiSelect: false
```

On "Open PR" → follow `shared/PR.md`. Print PR URL. Worktree stays open until merged (use `FINALIZE.md` mode=`cleanup-only` after merge).
On "Merge directly to main (no PR)" → run `FINALIZE.md` mode=`solo`.
On "Keep open" → print `/core-finalize`-hint.

**Team + no-gh — 2-way modal:**

```yaml
header: "Finalize"
question: "Feature '{feature-name}' verified. `gh` is not available — how do you want to finalize?"
options:
  - label: "Merge directly to main (no PR)"
    description: "Merge locally to main + cleanup worktree."
  - label: "Keep open"
    description: "Worktree stays open. Install gh + auth, then run /core-finalize {feature-name}."
multiSelect: false
```

On "Merge directly to main (no PR)" → run `FINALIZE.md` mode=`solo`.
On "Keep open" → print `/core-finalize`-hint.

---

## Output Report

```
FINALIZE COMPLETE

Mode:      {Solo-merge | Cleanup-only}
Feature:   {feature-name}
Branch:    {source_branch} → {deleted | kept}
Target:    {target}                              (solo-merge only)
Merge:     {sha}                                 (solo-merge only)
PR:        {pr_url}                              (cleanup-only only)
Worktree:  {WORKTREE_RESULT}
State:     {pushed {branch}@{shortsha} | no changes | skipped ({reason}) | failed ({reason})}
```

When `WORKTREE_RESULT` starts with `orphan-dir:` → also print:

```
⚠ Worktree directory remained on disk. Close any shells with cwd in {worktree_path}, then run:
  rmdir {worktree_path}
```

Also detect ghost cwd via `[ "$(pwd)" != "{main_root}" ] && [ ! -d "$(pwd)" ]`. If true → also print:

```
💡 Bash cwd is a ghost (worktree was removed but a subshell didn't follow).
   Start a fresh terminal in: {main_root}
```

> **Scope of `Merge: {sha}`**: for **dev-track** features (not COMPONENT/PAGE), this SHA is informational only — do NOT write it to `backlog.json` or `feature.json` as `shippedSha`. The `shipped` / `shippedAt` / `shippedSha` keys for dev-track are set exclusively by `/dev-ship (refactor phase)` after CLEAN or REFACTORED review (see `shared/BACKLOG.md` Lifecycle Protocol). For **design-track**, the Backlog sync step above writes the merge SHA as `shippedSha` **only for a PAGE that is already `DONE`** — never as a `DOING` → `DONE` promotion, and never for a COMPONENT (which ships with its consuming page). A `DOING` PAGE stays at TO CHECK until `/design-ship` ships it. Skills consuming this report (`dev-ship` / `game-ship` PHASE 4 finalize, `design-ship`, `core-finalize`) MUST treat the SHA as display-only for dev-track.

For cleanup-only with PR context:

```
✅ Cleanup complete: {source_branch} was merged via PR #{n}.

   Worktree: {WORKTREE_RESULT}
   Branch:   {deleted | kept}
```

For solo-merge:

```
✅ Merged into {target}: {sha}

   Source:  {source_branch}
   Push:    {pushed to origin/{target} | skipped}
   Worktree: {WORKTREE_RESULT}
```

## Failure Modes

| Situation                        | Action                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Dirty worktree                   | AskUserQuestion (Stop / Stash / Ignore)                                                    |
| Merge conflict                   | Show files, exit with manual-resolve instructions                                          |
| Branch not found                 | Fail with open worktree list                                                               |
| `git branch -d` fails (unmerged) | Confirm `git branch -D` with user                                                          |
| `gh` unavailable (solo project)  | Fall back to `solo` mode                                                                   |
| `gh` unavailable (team project)  | Halt — print install hint (see Detection matrix)                                           |
| Push rejected                    | AskUserQuestion: "Pull --rebase first (Recommended)" / "Force push (dangerous)" / "Cancel" |
