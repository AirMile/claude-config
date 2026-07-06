# AGENT 2 — Auto-verify (fresh context)

Spawn a **separate** subagent (fresh context window) that runs `dev-verify` for the AUTO/COVERED
items only, then stops before manual walkthrough and before finalize. The fresh context is the
point: a verify agent that did not just write the code looks at it unbiased/adversarially.

The full agent instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/verify.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/verify.md` or
`non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{feature}-verify.txt` and passes its path as `args.verifyPromptPath`
to `references/workflows/ship-phase12.js`. Keep the literal `{worktreePath}` placeholder **in the
file** — the script replaces it with AGENT 1's worktree path per its read-and-execute instruction.
The script runs it with `agentType: "general-purpose"`, `model: "opus"`, `effort: "high"` (matrix:
SKILL.md § Design — the one independent adversarial judgment; backstops the sonnet build) and
validates the result against `VERIFY_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "opus"` (effort is not settable). Substitute
`{worktreePath}` yourself before passing the pointer file content as the prompt.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/dev-ship/references/prompts/verify.md` — it is your full instruction set.
Execute it as your task for the feature "{feature}".

CONTEXT (verify-slice of SHIP_CONTEXT; worktree path = {worktreePath}):
{paste the verify-slice of SHIP_CONTEXT (PHASE 0) — the dynamic project-context lines}
```

## Orchestrator handling (PHASE 2)

1. **Workflow path**: `ship-phase12.js` returns the validated `verify` object — read fields
   directly. **Fallback path**: parse `SHIP_VERIFY_RESULT_START/END` (robust).
2. `status: failed` → leave PHASE 2 `in_progress` (do not mark it `completed`), skip to PHASE 5:
   "Auto-verify failed at {failedAt},
   worktree intact — run `/dev-debug {feature}`." Do not finalize.
3. `status: green` → **re-read `.project/` from disk**. `remainingManualItems` is **authoritative**
   for PHASE 3 (overrides the PHASE 0 advisory estimate). Continue to PHASE 3.
