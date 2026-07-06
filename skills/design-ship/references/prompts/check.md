You are AGENT 3 (check) in the design-ship pipeline. Execute the design-check workflow for the
TARGET feature (named in the CONTEXT block you were given) by reading
`.claude/skills/design-ship/references/design-check/workflow.md` and following it PHASE 0 → PHASE 4
(targeted feature mode; PHASE 5 is skipped per the file), with the NON-INTERACTIVE CONTRACT below.

Work in the existing build worktree given in your CONTEXT block ({worktreePath}) — cd there first;
run the dev server against it. Use the main repo path from your CONTEXT block for `.project/` reads.

Return your result per the RESULT CONTRACT in the non-interactive contract below (structured output
preferred; fallback = the delimited block).

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/design-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + TARGET:
Use the CONTEXT block you were given (the pointer that sent you here). It names the target, gives
the worktree path, and carries the check-slice of SHIP_CONTEXT (target routes/files from the build
result, stack, theme, auto-scope from SHIP_PLAN.checkScope). Use it instead of re-deriving; only
load what is missing there.

CHECK-SPECIFIC:

- targetType = "feature", the feature named in your CONTEXT block. Auto-scope per the §0.2 table —
  no scope modal.
- Refresh mutable context from `.project/` yourself (backlog entry, feature files) — the main
  chat is not in the loop between content and check.
- Fix scope = All CRITICAL + HIGH (your own selection — log it in autoDecisions). MEDIUM findings:
  report only.
- Auth flows (PHASE 1.0): no credentials available in non-interactive mode — audit public routes
  only and note skipped auth-gated checks in autoDecisions.
- Commit fixes in the worktree; never write DONE/shipped/lastCheckedSha (fix-reaudit copy §4.3).
- readyForDone = true only when zero unresolved CRITICAL findings remain after the re-audit.
- Kill the dev server before returning (contract rule 10).
- Fatal only when the app does not build/serve at all (§0.3.5 gate): return status "failed" with
  the build error. Findings — even remaining ones — are a green run with readyForDone false.

Result fields (structured output object; fallback = this exact block):
SHIP_DESIGN_CHECK_RESULT_START
status: green | failed
feature: {target}
checksRun: [Performance, SEO, ...]
findingsTotal: <n>
findingsResolved: <n>
findingsRemaining: <n>
readyForDone: true | false
criticalRemaining:

- <finding ID + one-line description, or none>
  failedAt: <step + short reason, or "none">
  autoDecisions:
- <auto-choice, or "none">
  SHIP_DESIGN_CHECK_RESULT_END
