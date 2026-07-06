# AGENT 3 — Refactor (pre-merge, in-worktree, test-guarded)

Spawn one subagent that runs `dev-refactor` on the single just-verified feature, **inside
`worktree-{feature}` on the feature branch (pre-merge)**, with the lenses **auto-derived in PHASE 0**
from the feature's signals. Skip this agent entirely only when the `--no-refactor` escape hatch was
set. Its commits land on the feature branch; the main chat merges (or attaches them to the PR) right
after this agent returns.

The full agent instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/refactor.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/refactor.md`
or `non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{feature}-refactor.txt` and passes its path as
`args.refactorPromptPath` to `references/workflows/ship-phase4.js` (or `null` when the
`--no-refactor` escape hatch was set), which has the agent read the file and runs it with
`agentType: "general-purpose"`, `model: "sonnet"`, `effort: "medium"` (matrix: SKILL.md § Design —
test-guarded revert-on-red, low risk) in parallel with any AGENT S scanners, and validates the
result against `REFACTOR_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "sonnet"` (effort is not settable).

### Pointer file (what the main chat writes — the ONLY assembled text)

Build the refactor-slice from the **post-verify** `.project/` (shared via worktree symlinks — built
files + fresh learnings), and list the auto-derived lenses + `securityLight` flag from `SHIP_PLAN`:

```
Read `.claude/skills/dev-ship/references/prompts/refactor.md` — it is your full instruction set.
Execute it as your task for the feature "{feature}".

CONTEXT (refactor-slice of SHIP_CONTEXT):
Worktree: worktree-{feature} at {worktreePath}
finalizeRoute: {merge|halt}
Lenses to run: {refactorLenses}   securityLight: {true|false}
{paste the refactor-slice of SHIP_CONTEXT (post-verify) — the dynamic project-context lines}
```

## Orchestrator handling (PHASE 4)

1. **Workflow path**: `ship-phase4.js` returns the validated `refactor` object — read fields
   directly. **Fallback path**: parse `SHIP_REFACTOR_RESULT_START/END` (robust).
2. `status: failed` (test-guard could not converge) → revert the branch
   (`git -C {worktreePath} reset --hard {preRefactorSha}`); non-fatal — proceed to the PHASE 4
   finalize step and merge the verified feature. Surface the failure in PHASE 5 for manual follow-up.
3. `status: applied | clean` → **re-read `.project/` from disk**, continue to the PHASE 4 finalize
   step.
4. If `SHIP_PLAN.securityDeep` is non-empty, AGENT S runs **in parallel** with this agent inside
   the same workflow (it is read-only and writes no `.project/`).
