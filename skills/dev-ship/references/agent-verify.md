# AGENT 2 — Auto-verify (fresh context)

Spawn a **separate** subagent (fresh context window) that runs `dev-verify` for the AUTO/COVERED
items only, then stops before manual walkthrough and before finalize. The fresh context is the
point: a verify agent that did not just write the code looks at it unbiased/adversarially.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.verifyPromptTemplate` to
`references/workflows/ship-phase12.js` with `{feature}` substituted but the literal
`{worktreePath}` placeholder **kept** — the script fills it from AGENT 1's structured result. The
script runs it with `agentType: "general-purpose"`, `model: "opus"`, `effort: "high"` (matrix:
SKILL.md § Design — the one independent adversarial judgment; backstops the sonnet build) and
validates the result against `VERIFY_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "opus"` (effort is not settable). Substitute both
`{feature}` and `{worktreePath}` and inline the non-interactive contract.

## Prompt template

```
You are AGENT 2 (auto-verify) in the dev-ship pipeline, running with a FRESH perspective — you did
not build this code; verify it adversarially. Execute the AUTOMATED portion of the `/dev-verify`
skill for the feature "{feature}" by reading `.claude/skills/dev-ship/references/dev-verify/workflow.md` and following it,
with the NON-INTERACTIVE CONTRACT and the SCOPE LIMITS below.

Return your result per the RESULT CONTRACT in the non-interactive contract below: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value.

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/dev-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of re-running the workflow's own PHASE 0 context-load; only load
what is missing here — note verify still does its OWN authoritative AUTO/MANUAL classification).
The slice below predates the build: BEFORE classifying, refresh the mutable parts yourself from
disk — re-read `project-context.json` learnings/architecture and `feature.json#files[]` (the build
agent just wrote them):
{paste the verify-slice of SHIP_CONTEXT (PHASE 0); worktree path = {worktreePath}}

SCOPE LIMITS (critical — this is a partial verify):
- Run dev-verify PHASE 0 (load + classify AUTO/MANUAL/COVERED per test-classification.md) and the
  automated testing of AUTO/COVERED items, including any fix-loop needed to make failing AUTO items
  pass. The worktree already exists (branch worktree-{feature} at {worktreePath}) — dev-verify's
  PHASE 0 detects and switches into it via WORKTREE.md; .project/ is shared so feature.json is
  present (the git-show reconciliation branch will not fire).
- DO NOT run the MANUAL walkthrough (dev-verify PHASE 2 / manual-walkthrough.md) — collect the
  MANUAL items and return them instead.
- DO NOT run completion-sync's DONE transition and DO NOT run PHASE Finalize — leave backlog status
  as DOING and do NOT merge or remove the worktree. Finalize is the main chat's job (PHASE 3).
- Commit any AUTO fix-loop changes into the worktree branch (scoped commit), same as dev-verify.
- If an AUTO item cannot be made to pass after the fix-loop: STOP, do not merge, return status
  "failed" with the item.

Result fields (structured output object — `remainingManualItems` is an array, empty when none;
fallback = this exact block):
SHIP_VERIFY_RESULT_START
status: green | failed
feature: {feature}
autoPass: <n>
autoTotal: <n>
covered: <n>
remainingManualItems:
  - id: <n>
    title: <manual item title>
    steps: [<step>, ...]
    expected: <observable outcome>
  # ... or "none"
failedAt: <item id + short reason, or "none">
autoDecisions:
  - <auto-choice, or "none">
SHIP_VERIFY_RESULT_END
```

## Orchestrator handling (PHASE 2)

1. **Workflow path**: `ship-phase12.js` returns the validated `verify` object — read fields
   directly. **Fallback path**: parse `SHIP_VERIFY_RESULT_START/END` (robust).
2. `status: failed` → leave PHASE 2 `in_progress` (do not mark it `completed`), skip to PHASE 5:
   "Auto-verify failed at {failedAt},
   worktree intact — run `/dev-debug {feature}`." Do not finalize.
3. `status: green` → **re-read `.project/` from disk**. `remainingManualItems` is **authoritative**
   for PHASE 3 (overrides the PHASE 0 advisory estimate). Continue to PHASE 3.
