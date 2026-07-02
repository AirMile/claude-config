# AGENT 3 — Refactor (post-merge, test-guarded)

Spawn one subagent that runs `dev-refactor` on the single just-shipped feature, on `main`
(post-merge), with the lenses and policy chosen in PHASE 0. Skip this agent entirely when
`SHIP_PLAN.refactorPolicy == skip`.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.refactorPrompt` to
`references/workflows/ship-phase4.js` (or `null` when `refactorPolicy == skip`), which runs it with
`agentType: "general-purpose"`, `model: "sonnet"`, `effort: "medium"` (matrix: SKILL.md § Design —
test-guarded revert-on-red, low risk) in parallel with any AGENT S scanners, and validates the
result against `REFACTOR_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "sonnet"` (effort is not settable).

Substitute `{feature}`, `{refactorLenses}`, `{refactorPolicy}`, `{securityLight}` from `SHIP_PLAN`.

## Prompt template

```
You are AGENT 3 (refactor) in the dev-ship pipeline. Execute the `/dev-refactor` skill scoped to
the SINGLE feature "{feature}" by reading `.claude/skills/dev-ship/references/dev-refactor/workflow.md` and following it,
with the NON-INTERACTIVE CONTRACT and the SCOPE below. The feature is DONE and already merged to
main — refactor operates on main (no worktree exists for it anymore; dev-refactor's WORKTREE.md
step is a no-op → it works on main directly).

Return your result per the RESULT CONTRACT in the non-interactive contract below: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block.

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/dev-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of re-running the workflow's own PHASE 0 context-load; only load
what is missing here):
{paste the refactor-slice of SHIP_CONTEXT (PHASE 0)}

SCOPE:
- Single-feature refactor: feature_queue = ["{feature}"] only. Do not scan or touch other features.
- Lenses to run: {refactorLenses}  (e.g. Reuse, Quality, Efficiency). Also run the Security lens
  only if {securityLight} is true.
- Policy "{refactorPolicy}":
    - conservative → apply only high-confidence findings; when a finding is borderline, skip it.
    - aggressive   → apply the broader set the lenses surface.
  In both cases the plan → single-approval step is auto-accepted (non-interactive): treat
  dev-refactor's combined plan as approved and proceed to apply.
- TEST-GUARDED (mandatory): follow dev-refactor's apply-rollback.md — after each feature's changes
  run the scoped test suite; keep on green, revert-that-change on red. Never leave the feature with
  failing tests. Final gate: full test suite green before returning.
- Commit the refactor on main as dev-refactor normally does. Do dev-refactor's normal .project/
  learnings sync and its completion writes (shipped backlog flip + archive).
- Do NOT run dev-refactor's PHASE Finalize / FINALIZE.md dispatch (the single-mode finalize step in
  completion-batch.md) — you are post-merge on main; there is nothing to merge (contract rule 7).

Result fields (structured output object; fallback = this exact block):
SHIP_REFACTOR_RESULT_START
status: applied | clean | failed
feature: {feature}
lenses: [{refactorLenses}]
techniquesApplied: <n>
techniquesReverted: <n>
testsGreen: true | false
notes: <1-line summary, or "no refactor opportunities found">
autoDecisions:
  - <auto-choice, or "none">
SHIP_REFACTOR_RESULT_END
```

## Orchestrator handling (PHASE 4)

1. **Workflow path**: `ship-phase4.js` returns the validated `refactor` object — read fields
   directly. **Fallback path**: parse `SHIP_REFACTOR_RESULT_START/END` (robust).
2. `status: failed` (test-guard could not converge) → report in PHASE 5; the feature is still
   shipped/merged (refactor is a post-merge polish, non-fatal). Surface for manual follow-up.
3. `status: applied | clean` → **re-read `.project/` from disk**, continue.
4. If `SHIP_PLAN.securityDeep` is non-empty, AGENT S runs **in parallel** with this agent inside
   the same workflow (it is read-only and writes no `.project/`).
