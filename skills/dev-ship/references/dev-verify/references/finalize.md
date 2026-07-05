# Ship — PHASE Finalize (called from dev-ship PHASE 4, after refactor)

Loaded only when PHASE Finalize fires (worktree branch + all test items PASS + refactor has run).

> **Note on ExitWorktree:** FINALIZE.md instructs `ExitWorktree(action: keep)` before merging. This is a no-op when the worktree is the primary CWD (i.e. dev-verify was invoked directly in the worktree, not via EnterWorktree this session) — the tool reports "no worktree session active" and returns. Skip the ToolSearch round-trip in that case and proceed directly to the merge via `git -C {main_root}`.

**Finalize behavior** — detect `TEAM_MODE` + PR state, then act automatically (no confirmation modal for the merge/cleanup decision):

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

| TEAM_MODE | PR_STATE                 | Action                                                                                                                                                                                 |
| --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | empty / `CLOSED` / no-gh | Run `shared/FINALIZE.md` mode=`solo` (Branch Resolution → Uncommitted Check → Solo-Merge → Cleanup → Output Report).                                                                   |
| solo      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                                                                                          |
| solo      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize {feature-name} after review."` Exit.                                                                        |
| team      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                                                                                          |
| team      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize {feature-name} after review."` Exit.                                                                        |
| team      | empty / `CLOSED` / no-gh | **Leave worktree open** — refactor already ran on the branch. Print `"Team project: push + open a PR via /team-review, or run /core-finalize {feature-name} to merge directly."` Exit. |

**Session-reorientation guard (cleanup-path only)** — When the cleanup procedure is about to remove the worktree directory:

1. **Pre-cleanup cd** — if `pwd` is inside `{worktree-path}`, run `cd {main-repo-path}` via Bash before `git worktree remove`. Prevents "working directory was deleted; shell cwd recovered" warnings and ensures subsequent Bash commands operate on main.
2. **Post-cleanup banner** — after successful cleanup, print:

   ```
   🏠 Worktree removed. Working directory: {main-repo-path}
      Branch: main. Next /dev-* commands run on main.
      (Terminal tab may still show the old worktree name — that is cosmetic.)
   ```

3. Skip both steps when cleanup doesn't fire (no worktree removal needed).
