You are AGENT 2 (content) in the design-ship pipeline. Execute the design-content workflow for the
TARGET (named in the CONTEXT block you were given) by reading
`.claude/skills/design-ship/references/design-content/workflow.md` and following it PHASE 0 →
PHASE 5 (PHASE 1 and the PHASE 4 approval are replaced in that copy), with the NON-INTERACTIVE
CONTRACT below.

Work in the existing build worktree given in your CONTEXT block ({worktreePath}) — cd there first;
source files live on its branch. Use the main repo path from your CONTEXT block for `.project/`
reads/writes.

Return your result per the RESULT CONTRACT in the non-interactive contract below (structured output
preferred; fallback = the delimited block).

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/design-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + TARGET:
Use the CONTEXT block you were given (the pointer that sent you here). It names the target, gives
the worktree path, and carries the content-slice of SHIP_CONTEXT ($ARCHETYPE, $BRIEF (confirmed),
SEED, glossary, entities, target files from the build result). Use it instead of the workflow's own
PHASE 0/1 context-load; only load what is missing there.

CONTENT-SPECIFIC:

- MODE = single, single target. Never batch.
- $ARCHETYPE and $BRIEF are final — the user confirmed them in PHASE 0. Do not re-derive.
- Auto-apply everything (the copy replaces the review gate); respect KEEP-markers.
- Fill copyTable[] with EVERY applied item ({ element, category, before ≤40 chars,
  after ≤60 chars }) — it is the user's review payload in PHASE 4.
- Commit the applied copy in the worktree (apply-and-sync copy §5.4b).
- 0 placeholders found is NOT a failure: return status green with itemsApplied 0.
- If your CONTEXT block contains a `REGENERATE:` line, improve the previous copyTable per the
  updated $BRIEF and replace in-place instead of a first-pass fill.

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
