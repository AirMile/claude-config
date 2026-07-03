# AGENT 3 — Check (design-check, self-selected fixes)

One subagent that runs the copied `design-check` workflow for the target non-interactively, in the
build worktree, in a **fresh context** (unbiased toward the build — the audit value). It
auto-scopes, scans, **chooses the fixes itself** (All CRITICAL + HIGH), re-audits, and commits —
but never merges and never writes DONE/shipped.

The full agent instruction body is the **static** file
`.claude/skills/design-ship/references/prompts/check.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/check.md` or
`non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{target}-check.txt` and passes its path as `args.checkPromptPath` to
`references/workflows/ship-design-phase123.js`. Keep the literal `{worktreePath}` placeholder **in
the file** — the agent substitutes it per the script's read-and-execute instruction. Runs with
`agentType: "general-purpose"`, `model: "opus"`, `effort: "high"` (matrix: SKILL.md § Design — the
one independent quality judgment before the user sees the page) and validates against `CHECK_SCHEMA`.

**Fallback (Agent tool)**: spawn via the `Agent` tool with `subagent_type: "general-purpose"`,
`model: "opus"`; substitute `{worktreePath}` yourself before passing the pointer file content.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/design-ship/references/prompts/check.md` — it is your full instruction set.
Execute it as your task for the feature "{target}".

CONTEXT (check-slice of SHIP_CONTEXT; worktree path = {worktreePath}; main repo path = {mainRepoPath}):
{paste the check-slice of SHIP_CONTEXT (PHASE 0) — target routes/files (from the build result),
stack, theme, auto-scope from SHIP_PLAN.checkScope}
```

## Orchestrator handling (PHASE 3)

1. **Workflow path**: the script returns the validated `check` object. **Fallback path**: parse
   `SHIP_DESIGN_CHECK_RESULT_START/END`.
2. `status: failed` → mark PHASE 1+2 `completed`, leave PHASE 3 `in_progress`, skip to PHASE 5:
   "Check failed at {failedAt}, worktree intact — fix the build error, then
   `/design-check {target}` in the worktree." Do not finalize.
3. `status: green` → **re-read `.project/` from disk**, carry `readyForDone` +
   `criticalRemaining` into the PHASE 4 review.
