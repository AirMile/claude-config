# AGENT 3 — Check (design-check, self-selected fixes)

One subagent that runs the copied `design-check` workflow for the target non-interactively, in the
build worktree, in a **fresh context** (unbiased toward the build — the audit value). It
auto-scopes, scans, **chooses the fixes itself** (All CRITICAL + HIGH), re-audits, and commits —
but never merges and never writes DONE/shipped.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.checkPromptTemplate` to
`references/workflows/ship-design-phase123.js` (the script substitutes `{worktreePath}`), runs
with `agentType: "general-purpose"`, `model: "opus"`, `effort: "high"` (matrix: SKILL.md § Design
— the one independent quality judgment before the user sees the page) and validates against
`CHECK_SCHEMA`.

**Fallback (Agent tool)**: spawn via the `Agent` tool with `subagent_type: "general-purpose"`,
`model: "opus"`; substitute `{worktreePath}` in the main chat first.

## Prompt template

```
You are AGENT 3 (check) in the design-ship pipeline. Execute the design-check workflow for the
feature "{target}" by reading `.claude/skills/design-ship/references/design-check/workflow.md`
and following it PHASE 0 → PHASE 4 (targeted feature mode; PHASE 5 is skipped per the file), with
the NON-INTERACTIVE CONTRACT below.

Work in the existing build worktree: {worktreePath} — cd there first; run the dev server against
it. Main repo path (for `.project/` reads): {mainRepoPath}

Return your result per the RESULT CONTRACT in the non-interactive contract below (structured
output preferred; fallback = the delimited block).

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/design-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of re-deriving; only load what is missing here):
{paste the check-slice of SHIP_CONTEXT (PHASE 0) — target routes/files (from the build result),
stack, theme, auto-scope from SHIP_PLAN.checkScope}

CHECK-SPECIFIC:
- targetType = "feature", featureName = {target}. Auto-scope per the §0.2 table — no scope modal.
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
```

## Orchestrator handling (PHASE 3)

1. **Workflow path**: the script returns the validated `check` object. **Fallback path**: parse
   `SHIP_DESIGN_CHECK_RESULT_START/END`.
2. `status: failed` → mark PHASE 1+2 `completed`, leave PHASE 3 `in_progress`, skip to PHASE 5:
   "Check failed at {failedAt}, worktree intact — fix the build error, then
   `/design-check {target}` in the worktree." Do not finalize.
3. `status: green` → **re-read `.project/` from disk**, carry `readyForDone` +
   `criticalRemaining` into the PHASE 4 review.
