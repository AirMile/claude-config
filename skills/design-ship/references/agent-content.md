# AGENT 2 — Content (design-content, auto-apply)

One subagent that runs the copied `design-content` workflow for the target non-interactively, in
the build worktree: scan placeholders → generate copy from the PHASE 0 brief → auto-apply →
backlog/glossary sync → worktree commit. The human copy review is deferred to design-ship PHASE 4
(against the live page) — this agent returns the `copyTable[]` payload for it.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.contentPromptTemplate` to
`references/workflows/ship-design-phase123.js` (the script substitutes the literal
`{worktreePath}` from AGENT 1's result), runs with `agentType: "general-purpose"`,
`model: "sonnet"`, `effort: "medium"` (matrix: SKILL.md § Design — brief-bound generation) and
validates against `CONTENT_SCHEMA`.

**Fallback (Agent tool)**: spawn via the `Agent` tool with `subagent_type: "general-purpose"`,
`model: "sonnet"`; substitute `{worktreePath}` in the main chat first.

## Prompt template

```
You are AGENT 2 (content) in the design-ship pipeline. Execute the design-content workflow for
"{target}" by reading `.claude/skills/design-ship/references/design-content/workflow.md` and
following it PHASE 0 → PHASE 5 (PHASE 1 and the PHASE 4 approval are replaced in that copy), with
the NON-INTERACTIVE CONTRACT below.

Work in the existing build worktree: {worktreePath} — cd there first; source files live on its
branch. Main repo path (for `.project/` reads/writes): {mainRepoPath}

Return your result per the RESULT CONTRACT in the non-interactive contract below (structured
output preferred; fallback = the delimited block).

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/design-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of the workflow's own PHASE 0/1 context-load; only load what is
missing here):
{paste the content-slice of SHIP_CONTEXT (PHASE 0) — $ARCHETYPE, $BRIEF (confirmed), SEED,
glossary, entities, target files from the build result}

CONTENT-SPECIFIC:
- MODE = single, TARGET = {target}. Never batch.
- $ARCHETYPE and $BRIEF are final — the user confirmed them in PHASE 0. Do not re-derive.
- Auto-apply everything (the copy replaces the review gate); respect KEEP-markers.
- Fill copyTable[] with EVERY applied item ({ element, category, before ≤40 chars,
  after ≤60 chars }) — it is the user's review payload in PHASE 4.
- Commit the applied copy in the worktree (apply-and-sync copy §5.4b).
- 0 placeholders found is NOT a failure: return status green with itemsApplied 0.

Result fields (structured output object; fallback = this exact block):
SHIP_DESIGN_CONTENT_RESULT_START
status: green | failed
feature: {target}
itemsApplied: <n>
itemsKept: <n>
filesModified: <n>
copyTable:
  - element: <selector/attr> | category: <heading|cta|label|error|…> | before: <old> | after: <new>
glossaryTerms: <n>
failedAt: <step + short reason, or "none">
autoDecisions:
  - <auto-choice, or "none">
SHIP_DESIGN_CONTENT_RESULT_END
```

## Orchestrator handling (PHASE 2)

1. **Workflow path**: the script substitutes `{worktreePath}` itself and returns the validated
   `content` object. **Fallback path**: parse `SHIP_DESIGN_CONTENT_RESULT_START/END`.
2. Content failure is **non-fatal** (`contentDegraded: true` in the workflow return): the page
   ships with placeholder copy unless the user regenerates in PHASE 4. Mark PHASE 2 `completed`
   with a degradation note; AGENT 3 still runs.
3. `status: green` → **re-read `.project/` from disk**, keep `copyTable` in memory for PHASE 4.

## Regenerate loop (PHASE 4 "Copy bijstellen")

When the user asks for a copy regeneration in the PHASE 4 review, re-spawn THIS agent via the
`Agent` tool (single agent — no workflow needed): same prompt, with `$BRIEF` updated per the
user's tone/language adjustment and an extra line
`REGENERATE: previous copyTable below — improve per the new brief, replace in-place.`
Cap at 3 regeneration rounds (mirrors review-gate.md §4.5).
