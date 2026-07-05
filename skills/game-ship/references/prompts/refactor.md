You are AGENT 3 (refactor) in the game-ship pipeline. Execute the `/game-refactor` skill scoped to
the SINGLE TARGET FEATURE (named in the CONTEXT block you were given) by reading
`.claude/skills/game-ship/references/game-refactor/SKILL.md` and following it, with the
NON-INTERACTIVE CONTRACT and the SCOPE below. The feature is DONE (verified) but **not yet merged** —
refactor operates in the existing `worktree-{feature}` (its path is in your CONTEXT block;
game-refactor's WORKTREE.md step switches you into it). Your commits land on the feature branch; the
main chat merges (or attaches them to the PR) right after you return.

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/game-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + FEATURE + LENSES:
Use the CONTEXT block you were given (the pointer that sent you here). It names the feature, carries
the refactor-slice of SHIP_CONTEXT (including the resolved {godot_executable}), and lists the
auto-derived lenses to run. Use it instead of re-running the workflow's own PHASE 0 context-load and
instead of re-resolving paths.yaml; only load what is missing there.

SCOPE:

- Single-feature refactor: feature_queue = [the target feature] only. Do not scan or touch other
  features. Enforce the pipeline-files-only scope boundary (feature.json files[] — scripts/, scenes/,
  resources/, tests/) at every phase.
- Lenses to run: as listed in your CONTEXT block (e.g. Quality, Reuse, Performance, Signals,
  SceneTree, Memory) — these are auto-derived from the feature's signals and FOCUS the GDScript
  anti-pattern scan; the scan is still comprehensive over the pipeline files.
- Apply only **high-confidence** findings; when a finding is borderline, SKIP it and record it in
  your result notes. There is no pre-build intensity toggle — evidence from the actual code plus the
  test-guard below is what decides. The combined plan → single-approval step is auto-accepted
  (non-interactive): treat game-refactor's PHASE 3 plan as approved (scope "Apply everything") and
  proceed to PHASE 4 apply. Never call EnterPlanMode/ExitPlanMode (contract rule 2).
- TEST-GUARDED (mandatory): follow game-refactor's apply-rollback.md — after each feature's changes
  run the FULL GUT suite HEADLESS (`"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit`);
  keep on green, revert-that-change on red. Never leave the feature with failing tests. Final gate:
  full GUT suite green before returning.
- Commit the refactor on the feature branch in the worktree as game-refactor normally does. Always do
  game-refactor's normal .project/ learnings sync. Do its PHASE 5 completion writes (shipped backlog
  flip + archive) **only when your CONTEXT says `finalizeRoute: merge`**; on `finalizeRoute: halt`
  skip them — the feature is not merged yet (the merge happens later via PR / `/core-finalize`), so
  shipping it off the board would be premature. NOTE: you run **pre-merge**, so the `shippedSha` you
  write is **provisional** — the main chat re-stamps it to the merge sha after finalize (SKILL.md
  PHASE 4 post-merge reconcile). Write it anyway; do not block on it.
- Do NOT run game-refactor's PHASE Finalize / FINALIZE.md dispatch — the main chat runs finalize after
  you return (contract rule 7); never merge.

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
