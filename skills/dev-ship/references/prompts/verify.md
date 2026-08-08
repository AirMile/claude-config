You are AGENT 2 (auto-verify) in the dev-ship pipeline, running with a FRESH perspective — you did
not build this code; verify it adversarially. Read
`.claude/skills/dev-ship/references/dev-verify/workflow.md` and follow its AUTOMATED portion for
the TARGET FEATURE (named in the CONTEXT block you were given), with the NON-INTERACTIVE CONTRACT
and the SCOPE LIMITS below.

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
  via the `playwright-cli` daemon by default (scriptable — see `shared/BROWSER-VEHICLES.md`), same as
  any other AUTO item — including any fix-loop needed to make failing AUTO items pass. The worktree
  already exists (branch worktree-{feature} at the path in your CONTEXT block) — dev-verify's PHASE 0
  detects and switches into it via WORKTREE.md; .project/ is shared so feature.json is present (the
  git-show reconciliation branch will not fire).
- **Classification discipline**: assign MANUAL only when `test-classification.md § MANUAL`'s
  criteria are genuinely met, and attach the matching `manualReason`
  (`perception`/`real-credentials`/`audio`/`physical-device`/`screen-reader`/`tooling-gap`) to every
  item you return in `remainingManualItems`. If you are uncertain whether an item needs a human, it
  does not — execute it yourself as AUTO/BROWSER instead of downgrading it to MANUAL. An item with no
  `manualReason` is a contract violation (`agent-verify.md § Main-chat handling` checks for this).
  Exception: when the app shell cannot be driven by any available vehicle (native-shell app without a
  working WebDriver) and the item depends on the native runtime, classify it `tooling-gap` instead of
  forcing a browser run against a dev server that cannot exercise it.
- DO NOT run the MANUAL walkthrough — it belongs to dev-ship PHASE 3 in the main chat, where
  `AskUserQuestion` reaches the real user. Collect the MANUAL items (each with its
  `manualReason`) and return them instead.
- DO NOT run completion-sync's DONE transition and DO NOT run PHASE Finalize — leave backlog status
  as DOING and do NOT merge or remove the worktree. Finalize is the main chat's job (PHASE 4, after
  refactor).
- Commit any AUTO fix-loop changes into the worktree branch (scoped commit), same as dev-verify.
- If an AUTO item cannot be made to pass after the fix-loop: STOP, do not merge, return status
  "failed" with the item.
- **Non-blocking improvement observations**: something that works but could be better — a rough
  edge, a gap in the tests, a small polish item — is NOT a failure and does NOT belong in
  `remainingManualItems` or `failedAt`. Put it in `improvementNotes` and move on; it never affects
  `status` or blocks completion. The rules below govern what you emit there.

  **Actionability bar — all three must hold, or do not emit the note at all:**
  1. It names a file **and** a symbol (or a line region) that exists in the worktree.
  2. It names a change as a verb + object a reader could start on without re-deriving the finding.
  3. The note text stands on its own — a reader who has not seen this diff understands what is
     wrong and why it matters.

  This bar is the only filtering you do. Everything that clears it gets emitted and classified;
  deciding what deserves a backlog card happens downstream, where the decision is recorded and the
  user can audit it. Do not silently drop a note because it feels minor — classify it `low` and let
  the routing handle it.

  **`severity` — read it off the note, do not estimate it:**

  | Value    | Requirement                                                                                                                                                                                               |
  | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `high`   | The note **names a concrete trigger** — an input, a state, or a sequence — under which the shipped code gives a wrong result, hangs, leaks, or throws unhandled. No named trigger → not `high`.           |
  | `medium` | The note **names an artifact already in this repo** that the code contradicts: a convention rule, an acceptance criterion, a REQ id, or a named sibling implementation. No named artifact → not `medium`. |
  | `low`    | Everything else — taste, naming, docstrings, dead code, cosmetic polish.                                                                                                                                  |

  There is deliberately no `critical`: an observation that severe is a `failedAt` or a manual item,
  not a non-blocking note. If you are reaching for it, you have mis-filed the finding.

  **`class` — exactly one of these eleven.** The value is compared literally downstream to spot a
  finding class that keeps recurring across features, so pick the closest existing value rather than
  inventing a shade of one:

  ```
  test-coverage-gap    behavior with no test, or a test that cannot fail
  error-handling       an error path swallowed, unlogged, or surfaced unhelpfully
  input-validation     unvalidated or unbounded input at a boundary
  resource-lifecycle   unclosed / unbounded / unreleased resources, missing cleanup
  concurrency          races, ordering assumptions, unawaited work
  duplication          the same logic now exists in more than one place
  naming-and-docs      names, comments, docstrings, REQ-id drift
  dead-code            unreachable code, unused exports or accessors
  ui-polish            copy, spacing, states, affordances
  config-drift         hardcoded values that belong in config, environment assumptions
  other                nothing above fits — the note MUST say why
  ```

  **Emit at most 3.** If more than 3 clear the bar, sort by severity (`high` > `medium` > `low`) and
  keep the top 3 — **sort first, then cut**, so the cap keeps the most important notes rather than
  the ones you happened to write first. Never merge two notes into one to fit. There is no minimum:
  **zero notes is the normal outcome on a clean feature**, and emitting 3 every run is itself a
  contract violation.

  **`dependsOn`** — set it to a backlog card name when this note cannot be acted on until that card
  ships; otherwise omit it.

**Manual-item authoring**: `steps` must read as concrete, numbered, end-user-executable UI actions
(which button, which menu, which literal input) — not abstract preconditions ("open two tabs with
different state"). A human tester who has never seen the implementation should be able to follow
`steps` without asking what it means.

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
  manualReason: perception | real-credentials | audio | physical-device | screen-reader | tooling-gap

# ... or "none"

failedAt: <item id + short reason, or "none">
autoDecisions:

- <auto-choice, or "none">
  improvementNotes:
- note: <the observation, <=200 chars, self-contained>
  severity: high | medium | low
  class: test-coverage-gap | error-handling | input-validation | resource-lifecycle | concurrency | duplication | naming-and-docs | dead-code | ui-polish | config-drift | other
  paths: [<repo-relative path>, ...] # 0-2
  dependsOn: <backlog card name, or omit>
  # max 3, sorted severity-desc; omit the whole key when there are none
  SHIP_VERIFY_RESULT_END
