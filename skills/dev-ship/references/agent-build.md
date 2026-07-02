# AGENT 1 — Build

One subagent that runs `dev-build` for the feature non-interactively, in an isolated context. It
creates the worktree and commits, but never merges.

## Spawn

**Primary (Workflow)**: this prompt is passed as `args.buildPrompt` to
`references/workflows/ship-phase12.js`, which runs it with `agentType: "general-purpose"`,
`model: "sonnet"`, `effort: "high"` (matrix: SKILL.md § Design — contract-driven TDD; feature.json

- tests bound the work) and validates the result against `BUILD_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` (needs full tools: Edit/Write/Bash/git) and `model: "sonnet"`
(effort is not settable on the Agent tool). Pass the prompt below with `{feature}` substituted and
the non-interactive contract inlined.

## Prompt template

```
You are AGENT 1 (build) in the dev-ship pipeline. Execute the `/dev-build` skill for the feature
"{feature}" by reading `.claude/skills/dev-ship/references/dev-build/workflow.md` and following it fully (PHASE 0 →
completion), with the NON-INTERACTIVE CONTRACT below.

Return your result per the RESULT CONTRACT in the non-interactive contract below: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value, not a human report.

NON-INTERACTIVE CONTRACT:
{paste the full contents of .claude/skills/dev-ship/references/non-interactive-contract.md}

SHIP_CONTEXT (use this instead of re-running the workflow's own PHASE 0 context-load; only load
what is missing here):
{paste the build-slice of SHIP_CONTEXT (PHASE 0)}

BUILD-SPECIFIC:
- dev-build already creates the worktree (WORKTREE.md) and never merges — keep it that way.
- Run the TDD build for all requirements; do dev-build's normal .project/ sync + scoped worktree
  commit at the end.
- Skip dev-build's terminal Next-Step Clipboard Offer.
- If the build cannot reach green after dev-build's own diagnostics/regression gate: STOP, do not
  merge, leave the worktree, and return status "failed" with the failing requirement.

Result fields (structured output object; fallback = this exact block):
SHIP_BUILD_RESULT_START
status: green | failed
feature: {feature}
worktreePath: <absolute path>
branch: worktree-{feature}
testsPass: <n>
testsTotal: <n>
filesCreated: <n>
filesModified: <n>
failedAt: <REQ-id + short reason, or "none">
autoDecisions:
  - <agent auto-choice made in place of an AskUserQuestion, or "none">
SHIP_BUILD_RESULT_END
```

## Orchestrator handling (PHASE 1)

1. **Workflow path**: `ship-phase12.js` returns the validated `build` object (and skips verify on
   failure) — read fields directly, no parsing. **Fallback path**: parse
   `SHIP_BUILD_RESULT_START/END` (robust — see non-interactive-contract.md).
2. `status: failed` → leave PHASE 1 `in_progress` (do not mark it `completed`), skip to PHASE 5
   report: "Build failed at {failedAt},
   worktree intact at {worktreePath} — run `/dev-debug {feature}`." AGENT 2 does not run.
3. `status: green` → **re-read `.project/` from disk**, carry `worktreePath` forward, continue to
   PHASE 2.
