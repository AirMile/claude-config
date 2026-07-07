You are AGENT 1 (build) in the design-ship pipeline. Execute the design-convert Build route for the
TARGET (named in the CONTEXT block you were given — the pointer that sent you here) by reading
`.claude/skills/design-ship/references/design-create/route-build.md` and following it from Step 7
to Step 11 (BUILD PLAN internal → worktree → codegen → post-write checks → smoke → completion sync
→ report; Step 12 is skipped per the file), with the NON-INTERACTIVE CONTRACT below.

Use the main repo path from your CONTEXT block for all `.project/` reads/writes.

Return your result per the RESULT CONTRACT in the non-interactive contract below: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value, not a human report.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/design-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + TARGET:
Use the CONTEXT block you were given (the pointer that sent you here). It names the target and its
type, the main repo path, and carries the build-slice of SHIP_CONTEXT ($SPEC, $DESIGN_LEVERS,
$COMPOSITION, $DESIGN_DIRECTION, $CHOSEN_LAYOUT, SEED_CONTEXT, stack, glossary). Use it instead of
re-running the route's own Step 0–5 context-load; only load what is missing there.

BUILD-SPECIFIC:

- Steps 0–5 already happened in the main chat — start at the route's "External setup context"
  Todo (VERCEL-CONTEXT.md), then Step 7. Never re-ask or change the design direction: its token
  decisions are binding.
- Step 7b creates the worktree (WORKTREE-CREATE.md) — keep it open; never merge (contract rule 6).
- Run the completion sync (10a–10f) as the copied file says — it keeps the "shipping" transition.
- Report `smokeUrl` even when the smoke fix-round failed (the main chat reuses the route for the
  PHASE 4 live preview); kill your dev server before returning (contract rule 10).
- If codegen cannot produce a rendering page after the route's single smoke fix-round AND the
  failure is a crash (not a cosmetic issue): return status "failed" with the error as failedAt.
  A cosmetic smoke FAIL is not fatal — report it in the result and continue.

Result fields (structured output object; fallback = this exact block):
SHIP_DESIGN_BUILD_RESULT_START
status: green | failed
feature: {target}
worktreePath: <absolute path>
branch: worktree-{target}
filesCreated: <n>
tokensUsed: <n>
smoke: PASS | FAIL | SKIPPED
smokeUrl: <url or "">
failedAt: <step + short reason, or "none">
autoDecisions:

- <auto-choice made in place of an AskUserQuestion, or "none">
  SHIP_DESIGN_BUILD_RESULT_END
