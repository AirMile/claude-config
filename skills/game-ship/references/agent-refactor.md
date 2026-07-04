# AGENT 3 — Refactor (post-merge, GUT test-guarded)

Spawn one subagent that runs `game-refactor` on the single just-shipped feature, on `main`
(post-merge), with the lenses **auto-derived in PHASE 0** from the feature's signals. Skip this agent
entirely only when the `--no-refactor` escape hatch was set.

The full agent instruction body is the **static** file
`.claude/skills/game-ship/references/prompts/refactor.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/refactor.md`
or `non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{feature}-refactor.txt` and passes its path as
`args.refactorPromptPath` to `references/workflows/ship-game-phase4.js` (or `null` when the
`--no-refactor` escape hatch was set), which has the agent read the file and runs it with
`agentType: "general-purpose"`, `model: "sonnet"`, `effort: "medium"` (matrix: SKILL.md § Design —
GUT test-guarded revert-on-red, low risk), and validates the result against `REFACTOR_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "sonnet"` (effort is not settable).

### Pointer file (what the main chat writes — the ONLY assembled text)

Build the refactor-slice from the **post-merge** `.project/` (built files + fresh learnings), and
list the auto-derived lenses from `SHIP_PLAN`:

```
Read `.claude/skills/game-ship/references/prompts/refactor.md` — it is your full instruction set.
Execute it as your task for the feature "{feature}".

CONTEXT (refactor-slice of SHIP_CONTEXT — includes the resolved {godot_executable}):
Lenses to run: {refactorLenses}
{paste the refactor-slice of SHIP_CONTEXT (post-merge) — the dynamic project-context lines}
```

## Orchestrator handling (PHASE 4)

1. **Workflow path**: `ship-game-phase4.js` returns the validated `refactor` object — read fields
   directly. **Fallback path**: parse `SHIP_REFACTOR_RESULT_START/END` (robust).
2. `status: failed` (test-guard could not converge) → report in PHASE 5; the feature is still
   shipped/merged (refactor is a post-merge polish, non-fatal). Surface for manual follow-up.
3. `status: applied | clean` → **re-read `.project/` from disk**, continue.
