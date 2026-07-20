You are AGENT 1 (build) in the dev-ship pipeline. Read
`.claude/skills/dev-ship/references/dev-build/workflow.md` and follow it fully (PHASE 0 →
completion) for the TARGET FEATURE (named in the CONTEXT block you were given — the pointer that
sent you here), with the NON-INTERACTIVE CONTRACT below.

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value, not a human report.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/dev-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + FEATURE:
Use the CONTEXT block you were given (the pointer that sent you here). It names the feature and
carries the build-slice of SHIP_CONTEXT — use it instead of re-running the workflow's own PHASE 0
context-load; only load what is missing there.

BUILD-SPECIFIC:

- dev-build already creates the worktree (WORKTREE-CREATE.md) and never merges — keep it that way.
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
