# AGENT 1 — Build (design-create Build route)

One subagent that runs the copied `design-create` Build route (Steps 7–11) for the target
non-interactively, in an isolated context. It creates the worktree, generates the code with the
user-chosen design direction, runs the smoke check, and commits — but never merges.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.buildPrompt` to
`references/workflows/ship-design-phase123.js`, which runs it with `agentType: "general-purpose"`,
`model: "sonnet"`, `effort: "high"` (matrix: SKILL.md § Design — direction + spec bound the work)
and validates the result against `BUILD_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` (needs full tools: Edit/Write/Bash/git) and `model: "sonnet"`
(effort is not settable on the Agent tool). Pass the prompt below with placeholders substituted
and the non-interactive contract inlined.

## Prompt template

```
You are AGENT 1 (build) in the design-ship pipeline. Execute the design-create Build route for
"{target}" ({targetType}) by reading
`.claude/skills/design-ship/references/design-create/route-build.md` and following it from Step 7
to Step 11 (BUILD PLAN internal → worktree → codegen → post-write checks → smoke → completion
sync → report; Step 12 is skipped per the file), with the NON-INTERACTIVE CONTRACT below.

Main repo path (for `.project/` reads/writes): {mainRepoPath}

Return your result per the RESULT CONTRACT in the non-interactive contract below: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value, not a human report.

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/design-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of re-running the route's own Step 0–5 context-load; only load
what is missing here):
{paste the build-slice of SHIP_CONTEXT (PHASE 0) — $SPEC, $DESIGN_LEVERS, $COMPOSITION,
$DESIGN_DIRECTION, $CHOSEN_LAYOUT, SEED_CONTEXT, stack, glossary}

BUILD-SPECIFIC:
- Steps 0–5 already happened in the main chat — start at the route's "External setup context"
  Todo (VERCEL-CONTEXT.md), then Step 7. Never re-ask or change the design direction: its token
  decisions are binding.
- Step 7b creates the worktree (WORKTREE.md) — keep it open; never merge (contract rule 6).
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
```

## Orchestrator handling (PHASE 1)

1. **Workflow path**: `ship-design-phase123.js` returns the validated `build` object (and skips
   content/check on failure) — read fields directly, no parsing. **Fallback path**: parse
   `SHIP_DESIGN_BUILD_RESULT_START/END` (robust — see non-interactive-contract.md).
2. `status: failed` → leave PHASE 1 `in_progress` (do not mark it `completed`), skip to PHASE 5
   report: "Build failed at {failedAt}, worktree intact at {worktreePath} — run
   `/design-create {target}` to patch, or inspect the worktree." AGENT 2/3 do not run.
3. `status: green` → **re-read `.project/` from disk**, carry `worktreePath` + `smokeUrl` forward,
   continue to PHASE 2.
