# Dev Verify — PHASE Finalize

Loaded only when PHASE Finalize fires (worktree branch + all test items PASS).

> **Note on ExitWorktree:** FINALIZE.md instructs `ExitWorktree(action: keep)` before merging. This is a no-op when the worktree is the primary CWD (i.e. dev-verify was invoked directly in the worktree, not via EnterWorktree this session) — the tool reports "no worktree session active" and returns. Skip the ToolSearch round-trip in that case and proceed directly to the merge via `git -C {main_root}`.

**PR offer (team-mode only)** — show first, only if ALL true:

1. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
2. `gh` on PATH AND `gh auth status` exit 0
3. Clean tree (`git status --porcelain` empty)

If all true → AskUserQuestion:

```yaml
header: "Open PR"
question: "Push + open PR for worktree-{feature-name}?"
options:
  - label: "Yes, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "No, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Yes" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "No" or any precondition fail → fall through to finalize prompt.

**Finalize behavior** — follow `shared/FINALIZE.md → Finalize Offer Decision`.

**Session-reorientation guard (cleanup-path only)** — When the cleanup procedure is about to remove the worktree directory:

1. **Pre-cleanup cd** — if `pwd` is inside `{worktree-path}`, run `cd {main-repo-path}` via Bash before `git worktree remove`. Prevents "working directory was deleted; shell cwd recovered" warnings and ensures subsequent Bash commands operate on main.
2. **Post-cleanup banner** — after successful cleanup, print:

   ```
   🏠 Worktree removed. Working directory: {main-repo-path}
      Branch: main. Next /dev-* commands run on main.
      (Terminal tab may still show the old worktree name — that is cosmetic.)
   ```

3. Skip both steps when cleanup doesn't fire (PR-path without cleanup, or "Keep open" chosen).

```yaml
# MERGED state only:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} has been merged ({PR_URL}). Clean up now? Worktree + local branch will be removed."
options:
  - label: "Yes, cleanup now (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — remove worktree + branch"
  - label: "Keep open"
    description: "Worktree stays for follow-up commits"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On MERGED "Keep open" → print `💡 Run /dev-refactor {feature-name} on this worktree when ready`.
