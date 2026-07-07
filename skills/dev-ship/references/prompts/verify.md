You are AGENT 2 (auto-verify) in the dev-ship pipeline, running with a FRESH perspective — you did
not build this code; verify it adversarially. Execute the AUTOMATED portion of the `/dev-verify`
skill for the TARGET FEATURE (named in the CONTEXT block you were given) by reading
`.claude/skills/dev-ship/references/dev-verify/workflow.md` and following it, with the
NON-INTERACTIVE CONTRACT and the SCOPE LIMITS below.

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/dev-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + FEATURE + WORKTREE:
Use the CONTEXT block you were given (the pointer that sent you here). It names the feature, carries
the verify-slice of SHIP_CONTEXT, and gives the worktree path. Use it instead of re-running the
workflow's own PHASE 0 context-load; only load what is missing there — note verify still does its
OWN authoritative AUTO/MANUAL classification. The slice predates the build: BEFORE classifying,
refresh the mutable parts yourself from disk — re-read `project-context.json` learnings/architecture
and `feature.json#files[]` (the build agent just wrote them).

SCOPE LIMITS (critical — this is a partial verify):

- Run dev-verify PHASE 0 (load + classify AUTO/MANUAL/COVERED per test-classification.md) and the
  automated testing of AUTO/COVERED items — this includes AUTO/BROWSER items: execute them yourself
  via Claude-in-Chrome (preferred) or the `playwright-cli` daemon (fallback — see
  `shared/CLAUDE-IN-CHROME.md`), same as any other AUTO item — including any fix-loop needed to make
  failing AUTO items pass. The worktree already exists (branch worktree-{feature} at the path in your
  CONTEXT block) — dev-verify's PHASE 0 detects and switches into it via WORKTREE.md; .project/ is
  shared so feature.json is present (the git-show reconciliation branch will not fire).
- **Classification discipline**: assign MANUAL only when `test-classification.md § MANUAL`'s
  criteria are genuinely met, and attach the matching `manualReason`
  (`perception`/`real-credentials`/`audio`/`physical-device`/`screen-reader`) to every item you
  return in `remainingManualItems`. If you are uncertain whether an item needs a human, it does
  not — execute it yourself as AUTO/BROWSER instead of downgrading it to MANUAL. An item with no
  `manualReason` is a contract violation (`agent-verify.md § Main-chat handling` checks for this).
- DO NOT run the MANUAL walkthrough (dev-verify PHASE 2 / manual-walkthrough.md) — collect the
  MANUAL items (each with its `manualReason`) and return them instead.
- DO NOT run completion-sync's DONE transition and DO NOT run PHASE Finalize — leave backlog status
  as DOING and do NOT merge or remove the worktree. Finalize is the main chat's job (PHASE 4, after
  refactor).
- Commit any AUTO fix-loop changes into the worktree branch (scoped commit), same as dev-verify.
- If an AUTO item cannot be made to pass after the fix-loop: STOP, do not merge, return status
  "failed" with the item.

Result fields (structured output object — `remainingManualItems` is an array, empty when none;
fallback = this exact block):
SHIP_VERIFY_RESULT_START
status: green | failed
feature: {feature}
autoPass: <n>
autoTotal: <n>
covered: <n>
remainingManualItems:

- id: <n>
  title: <manual item title>
  steps: [<step>, ...]
  expected: <observable outcome>
  manualReason: perception | real-credentials | audio | physical-device | screen-reader

# ... or "none"

failedAt: <item id + short reason, or "none">
autoDecisions:

- <auto-choice, or "none">
  SHIP_VERIFY_RESULT_END
