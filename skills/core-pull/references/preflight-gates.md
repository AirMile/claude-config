# core-pull — Pre-flight Gates

Loaded from PHASE 0 when the preflight JSON triggers a gate. Handle every triggered gate in the order below; continue to PHASE 0 step 2 unless a gate exits.

**Inputs** (from preflight JSON): `open_worktrees`, `onboard.{nudge,reason,dismissed}`, `total_commits`, `context_updated`.

## Gate 1: Open worktrees (`open_worktrees` non-empty)

core-pull resets `.project/` on main — that wipes the symlinks that write worktree state to main.

**AskUserQuestion**:

```yaml
header: "Open worktrees"
question: "Open worktrees found: {list}. core-pull resets `.project/` on main — that wipes the symlinks that write worktree state to main. What do you want to do?"
options:
  - label: "Stop — merge open worktrees first (Recommended)"
    description: "Run /core-finalize per open worktree, then /core-pull again"
  - label: "Continue anyway"
    description: "Pull now; worktree state on main may be lost (the worktree itself stays intact)"
multiSelect: false
```

On "Stop" → exit. On "Continue anyway" → log a warning in the PHASE 5 report and continue.

## Gate 2: Onboard nudge (`onboard.nudge` = true)

The preflight script already evaluated the full condition (not dismissed, not onboarded, >50 commits, and either no learnings or a stale baseline). `onboard.reason` picks the question wording:

| `onboard.reason` | Question                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-learnings`   | "This looks like a new codebase for you ({total_commits} commits, no learnings). `/core-setup --mode=mature` builds base memory from conventions, patterns and pitfalls in existing code. Run now?"                                           |
| `stale-baseline` | "Project memory looks frozen (context.updated: {context_updated}, >90 days old — typical after joining a repo whose committed `.project/` baseline froze at setup time). `/core-setup --mode=mature` rebuilds it from current code. Run now?" |

**AskUserQuestion**:

```yaml
header: "Onboard?"
question: "{from table above}"
options:
  - label: "Yes, run /core-setup (Recommended)"
    description: "Exit core-pull and build base memory first"
  - label: "No, just pull"
    description: "Continue with the pull; memory stays as-is"
  - label: "Don't ask again for this project"
    description: "Write dismissal marker, continue with the pull"
multiSelect: false
```

- **"Yes"** → exit with message: `RUN /core-setup --mode=mature FOR BASE MEMORY (then re-run /core-pull for incremental updates)`. No pull/sync.
- **"No, just pull"** → continue.
- **"Don't ask again"** → `touch .project/session/onboard-dismissed`, continue.
