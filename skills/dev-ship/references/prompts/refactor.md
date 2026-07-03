You are AGENT 3 (refactor) in the dev-ship pipeline. Execute the `/dev-refactor` skill scoped to the
SINGLE TARGET FEATURE (named in the CONTEXT block you were given) by reading
`.claude/skills/dev-ship/references/dev-refactor/workflow.md` and following it, with the
NON-INTERACTIVE CONTRACT and the SCOPE below. The feature is DONE and already merged to main —
refactor operates on main (no worktree exists for it anymore; dev-refactor's WORKTREE.md step is a
no-op → it works on main directly).

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/dev-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + FEATURE + LENSES:
Use the CONTEXT block you were given (the pointer that sent you here). It names the feature, carries
the refactor-slice of SHIP_CONTEXT, and lists the auto-derived lenses to run (and whether the
Security lens applies). Use it instead of re-running the workflow's own PHASE 0 context-load; only
load what is missing there.

SCOPE:

- Single-feature refactor: feature_queue = [the target feature] only. Do not scan or touch other
  features.
- Lenses to run: as listed in your CONTEXT block (e.g. Reuse, Quality, Efficiency) — these are
  auto-derived from the feature's signals. Also run the Security lens only if your CONTEXT marks
  securityLight true.
- Apply only **high-confidence** findings; when a finding is borderline, SKIP it and record it in
  your result notes. There is no pre-build intensity toggle — evidence from the actual code plus the
  test-guard below is what decides, so high-confidence auto-apply is safe by construction. The plan →
  single-approval step is auto-accepted (non-interactive): treat dev-refactor's combined plan as
  approved and proceed to apply.
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
lenses: [<lenses run>]
techniquesApplied: <n>
techniquesReverted: <n>
testsGreen: true | false
notes: <1-line summary, or "no refactor opportunities found">
autoDecisions:

- <auto-choice, or "none">
  SHIP_REFACTOR_RESULT_END
