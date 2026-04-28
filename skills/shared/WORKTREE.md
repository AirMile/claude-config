# Worktree Switch Boilerplate

Used in FASE 0 of pipeline skills that operate on a single feature (verify, debug, refactor single-mode). Skip in batch/codebase modes.

## Why

Pipeline skills run in separate chats. When `dev-build` (or `game-build`) creates a worktree, follow-up skills start in main-checkout — not in the worktree where the code lives. This boilerplate detects an existing worktree for the active feature and switches into it automatically.

The worktree path is predictable: `{repo-root}/.claude/worktrees/{feature-name}`. The branch name is `worktree-{feature-name}` (auto-prefixed by `EnterWorktree`).

## Skip the entire procedure if

- **feature-name is not known** (e.g. debug skill called without active feature context)
- **skill is in batch-mode** (refactor with `feature_queue.length > 1`)
- **skill is in codebase-mode** (refactor on full codebase, not feature-bound)

In skip cases: do not run any of the steps below. Continue the calling skill's FASE 0 on the current branch.

## Procedure

Run after the feature-name is known. Before any state-mutating operations (backlog tag updates, session-file writes, commits).

### Step 1: Determine main repo root

The first entry in `git worktree list --porcelain` is always the main checkout, regardless of where the current session is running.

```bash
main_root=$(git worktree list --porcelain | head -1 | awk '{print $2}')
```

### Step 2: Compute expected worktree path

```
expected_path = "{main_root}/.claude/worktrees/{feature-name}"
```

### Step 3: Read current state

- `current_root = git rev-parse --show-toplevel`
- `registered = expected_path appears in git worktree list --porcelain`

### Step 4: Decide and act

| current_root       | registered | Action                                                                                                                                         |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| == `expected_path` | yes        | **Skip** — already in the right worktree                                                                                                       |
| == `main_root`     | yes        | Call `EnterWorktree(path: expected_path)` to switch                                                                                            |
| other worktree     | yes        | **FAIL** — print: "Je zit in worktree {pwd}, deze skill is voor feature {feature-name}. Exit eerst via ExitWorktree(action: keep) en restart." |
| == `main_root`     | no         | **Continue** — no worktree was used for this feature, run on current branch                                                                    |
| == `expected_path` | no         | **Continue cautiously** — pwd matches but not registered (rare race condition)                                                                 |

### Step 5: Continue with skill FASE 0

After successful switch (or skip), proceed with the rest of the skill's FASE 0.

## Caveats

### Branch naming

`EnterWorktree(name: "auth")` creates branch `worktree-auth`, NOT `auth`. For merge / cleanup commands (e.g. `git branch -D worktree-auth`), use the prefixed name. The `core-merge` skill handles this automatically.

### Skip conditions

Skip the entire procedure when:

- **Refactor batch-mode**: feature queue contains multiple features OR codebase-mode selected
- **Refactor codebase-mode**: not feature-bound, runs on main
- **No active feature**: e.g. debug skill called without context — run standalone

### Cleanup

This procedure does not remove worktrees. Use `/core-merge` to integrate and clean up at end-of-feature, or remove manually:

```bash
git worktree remove --force {worktree_path}
git branch -D worktree-{feature}
```
