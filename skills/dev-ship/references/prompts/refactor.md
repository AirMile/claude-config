You are AGENT 3 (refactor) in the dev-ship pipeline. Execute the `/dev-refactor` skill scoped to the
SINGLE TARGET FEATURE (named in the CONTEXT block you were given) by reading
`.claude/skills/dev-ship/references/dev-refactor/workflow.md` and following it, with the
NON-INTERACTIVE CONTRACT and the SCOPE below. The feature is DONE (verified) but **not yet merged** —
refactor operates in the existing `worktree-{feature}` (its path is in your CONTEXT block;
dev-refactor's WORKTREE.md step switches you into it). Your commits land on the feature branch; the
main chat merges (or attaches them to the PR) right after you return.

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
- Commit the refactor on the feature branch in the worktree as dev-refactor normally does. Always do
  dev-refactor's normal .project/ learnings sync. Do its completion writes (shipped backlog flip +
  archive) **only when your CONTEXT says `finalizeRoute: merge`**; on `finalizeRoute: halt` skip them
  — the feature is not merged yet (the merge happens later via PR / `/core-finalize`), so shipping it
  off the board would be premature. NOTE: you run **pre-merge**, so the `shippedSha` you write
  (`git rev-parse HEAD` = your refactor commit) is **provisional** — the main chat re-stamps it to the
  merge sha after finalize (SKILL.md PHASE 4 post-merge reconcile). Write it anyway; do not block on it.
- Do NOT run dev-refactor's PHASE Finalize / FINALIZE.md dispatch (the single-mode finalize step in
  completion-batch.md) — the main chat runs finalize after you return (contract rule 7); never merge.
- Skip dev-refactor's terminal REFACTOR COMPLETE next-steps + Next-Step Clipboard Offer
  (completion-batch.md § Step 6) — non-interactive-contract.md rule 4 covers this, restated here to
  match `prompts/build.md`'s existing "Skip dev-build's terminal Next-Step Clipboard Offer" line.

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
