# PHASE 4 + 5 — Fix Plans, Selection & Implementation

Loaded from `SKILL.md § PHASE 3` when the user chose "Yes, generate fix plans" and `ExitPlanMode`
closed the aggregation/report session. Owns everything from the fix-plan fan-out through the
worktree'd implementation and finalize offer.

## PHASE 4: Fix Plans

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Write the findings file and 3 planner prompt files, launch `security-fix-plans.js`, patch the audit
state — follow `.claude/skills/dev-security/references/orchestration.md § 3` exactly. **End the
turn** after launch; the task-notification with the workflow's `{plans, plannersFailed}` result
wakes you back up.

On return: write the full `plans` object **verbatim** to a sibling file
`.project/security/audit-{id}-plans.json` (mirrors the existing `-findings.json` split) — every
strategy's `fixes[]`, `notes`, `coverage`, `effortEstimate`, not a summary. **Do not paraphrase or
shorten `notes` when persisting** — copy the workflow's returned string field for field; if the
task-notification's `<result>` block truncated it, `Read` the full `<output-file>` first (per the
notification's own instructions) and persist that. Patch the audit state's
own `plans` field with just `{ [strategy]: { fixesCount, filesTouched, effortEstimate, coverage } }`
per strategy plus a `plansRef` pointer to the sibling file — keeps the primary audit-state file
small while still making the full verbatim plans durably retrievable (not just live in the
workflow's session-scoped transcript journal).

## PHASE 5 gate (plan mode)

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` (a fresh entry — the PHASE 3 plan-mode session
already closed via its own `ExitPlanMode` before PHASE 4 could launch a Workflow).

### Step 1: Present options

Show all 3 plans side by side (same table `SKILL.md` used before this extraction):

```
FIX STRATEGIES
|          | Minimal       | Pragmatic   | Extensive   |
| -------- | ------------- | ----------- | ----------- |
| Fixes    | [N]           | [N]         | [N]         |
| Files    | [N]           | [N]         | [N]         |
| Effort   | [est]         | [est]       | [est]       |
| Risk     | Low           | Medium      | Medium-High |
| Coverage | CRITICAL only | CRIT + HIGH | All         |
```

A strategy missing from `plans` (in `plannersFailed`) → show "unavailable — agent failed" in its
column instead of blocking the other two.

### Step 2: Select strategy + fixes

**Feature-scoped audit** (PHASE 1 scope was auto-resolved from an explicit `{feature}` arg per
`SKILL.md` Step 2) → skip both the strategy modal and the numbered-list fix-picker: select
Pragmatic automatically, with every fix it proposes. Log: `Fix strategy: pragmatic, alle {n}
fixes (auto, feature-scope)`. The Step 1 comparison table still displays first so the user sees
what was chosen before implementation starts.

**Full-codebase or otherwise-scoped audit** → AskUserQuestion — header: "Fix Strategy", question:
"Which fix strategy do you want to apply?":

- "Pragmatic (Recommended)" — CRITICAL + HIGH, good balance
- "Minimal" — CRITICAL only, lowest risk
- "Extensive" — Everything, including preventive measures

Then present the chosen plan's fix list numbered and ask via **free-text input, never
`AskUserQuestion`** — follow `shared/SKILL-PATTERNS.md § Numbered List Selection` exactly (the user
must cherry-pick from all findings at once; a modal's preset bundles cannot offer that). Prompt:
"Which fixes do you want to apply? Provide numbers (e.g. `1, 3` or `all`)." Parse → fix-set.

`ExitPlanMode` once the fix-set is chosen (auto-selected or user-picked) — present the chosen
strategy + selected fixes as the plan output. Rejected → stay in plan mode, revise, re-present,
loop until accepted.

## Worktree

After accept, run `shared/WORKTREE-CREATE.md § Auto-create` with feature-name
`security-hardening-{YYYYMMDD}` (today's date) and `knownUnrelatedScope: scope.files` (Step 1b's
dirty-work guard then auto-skips its modal when the working tree's uncommitted changes have zero
overlap with this run's own scope — the collision matrix applies unchanged regardless).

**Caveat — `.project/security/` is not in the worktree's shared-symlink list**
(`shared/WORKTREE.md § What to share` only symlinks `backlog.json`/`features`/`project.json`/
`project-context.json`/`wireframes`/`screenshots`/`thinking`). Every audit-state write from this
point on must go to `{MAIN_ROOT}/.project/security/...` — `MAIN_ROOT` was resolved and stored in the
audit state at PHASE 1 (`SKILL.md § PHASE 1`'s audit-state creation step); reuse it rather than
re-deriving cwd-relative paths from inside the worktree.

Patch the audit state's `worktree` field to `{ path: "{WT_PATH}", branch: "security-hardening-{date}" }`
immediately after `EnterWorktree` succeeds — not deferred to the final summary patch, so a crash
mid-implementation still leaves the worktree location recorded for recovery.

Skip Step 3's `ship-checkpoint.js signal` call from `WORKTREE-CREATE.md` — the audit-state file is
this skill's own resume signal (PHASE 1), not a ship-pipeline checkpoint; there is no
`active-security-hardening-{date}.json` board row to maintain.

## Implement

Apply the chosen strategy's selected fixes in the worktree. Group fixes that share the same root
cause/code path into one coherent edit (the fix-plan's own "resolved as side effect of" fixes are
the common case) — state which finding numbers each edit addresses; apply genuinely independent
fixes as separate edits. Verify syntax (type-check / lint) after all edits land, once per run —
not per file; the fixes in one grouped edit are interdependent, so an incremental per-file check
would false-positive on files that reference not-yet-edited siblings.

Run the project's test suite if one exists (detect from `package.json` / project convention — same
detection `debug-round-heavy.md § 7` uses). **First check the worktree has its own installed
dependencies**: a fresh `git worktree add` only creates a working tree, not `node_modules` — if a
lockfile exists in the worktree but `node_modules` doesn't, run the project's install command there
first. Skipping this can produce confusing false results rather than a clean error: some test
runners' implicit module resolution (e.g. Vite's `import.meta.glob` resolved relative to a package's
own install location) silently falls back to a _different_ root's code when `node_modules` is
missing locally.

**A test failing because of the fix's own intentional behavior change is not a regression** —
update the test to the new (secure) contract; never weaken or revert the fix to keep a stale test
green. A test failing for an unrelated reason → verify it also fails on the pre-fix branch before
treating it as pre-existing.

Commit on the worktree branch:

```
fix(security): apply {strategy} remediation — {N} fixes
```

Never stage or commit `.project/` — it is gitignored per-developer runtime state (same rule as the
rest of `.project/session/`).

## Summary + finalize offer

> **Todo**: mark PHASE 5 → `completed`.

```
SECURITY AUDIT COMPLETE
Score: {aggregate.overallScore before} → estimated {after}
Strategy: {chosen}
Fixes applied: {N}
Files modified: {N}
Remaining items: {N} (deferred)
```

Patch the audit state `status: "complete"`, `phase: "PHASE 5"` — **the file is kept**, not removed
(unlike the ship checkpoint): it is the durable audit record, and a later `/dev-security {feature}`
run's ship-triage preload (`SKILL.md § PHASE 1`) may still want to reference it.

**Close the originating backlog card.** `shared/BACKLOG.md` declares `SECURITY` as a valid card
type but documents no lifecycle for it. Find `.project/backlog.json#features[]` entry matching
`type === "SECURITY" && parentFeature === {scope.feature}` (present whenever the audit ran via the
ship-triage-follow-up scope). Already `status: "DONE"` (an earlier run already closed it) → leave
untouched, skip silently. Otherwise, if found: set `status: "DONE"`, `shipped: true`, `shippedAt`
(today), `shippedSha` (the fix commit — worktree SHA if unmerged, main SHA if the inline merge below
ran), `summary` (one line, the fix strategy + finding count). Mirrors the TWEAK card lifecycle
(`shared/BACKLOG.md § TWEAK cards`: "TODO → shipped directly"), since SECURITY cards are also
created ad hoc outside the main FEATURE ship pipeline. No matching card (e.g. full-codebase scope,
no `scope.feature`) → skip silently.

**Surface deferred findings.** Findings the chosen strategy did not fix (`plans.{chosenStrategy}`'s
deferred list — or, on the "No, report only" branch, every CRITICAL/HIGH finding in
`aggregate.findings`) do not just disappear into the audit-state file: for each, first check
`.project/backlog.json#features[]` for an existing `type: "SECURITY"` card with the same
`parentFeature` and a matching `file`+`category` in its `description` that is still
`status: "TODO"` — found → skip (already surfaced, avoid a duplicate), otherwise append a
lightweight card:
`{name: "security-followup-{auditId}-{n}", type: "SECURITY", status: "TODO", phase: "P2",
description: "{finding.issue} (deferred from audit {auditId}, {finding.severity} {finding.category})",
parentFeature: scope.feature ?? null}`. This gives deferred findings the same backlog-visibility
path ship-triage already gives confirmed findings, so a later `/dev-security` run or `/project-todo`
review can pick them back up instead of them only ever existing inside one timestamped audit-state
JSON nobody re-reads.

> **Todo**: offer to merge now instead of only handing off to a separate command.

`worktree === null` (run continued directly on `{default branch}` — the § Worktree dirty-work
guard skipped auto-create) → skip the Merge question entirely, nothing to merge. Go straight to
the Next-Step Clipboard Offer below.

Otherwise, AskUserQuestion — header: "Merge", question: "Worktree `security-hardening-{date}` is
ready (commit shown above). Merge it into main now?":

- "Ja, review diff en merge nu (Aanbevolen)" — show the **full, unfiltered** `git diff
  {default}...worktree-security-hardening-{date}` (no path args — every changed file, including
  tests) for user review, then run `shared/FINALIZE.md` inline (same integrated pattern `dev-ship`/
  `game-ship`/`design-ship` already use for their own PHASE 4 Finalize) with
  `feature-name: security-hardening-{date}`. On success, re-run the backlog-close step above using
  the **merge commit's** SHA (not the pre-merge fix-commit SHA). Then apply the Next-Step Clipboard
  Offer (binary Ja/Nee) — read `.claude/skills/shared/NEXT-STEP-OFFER.md`. Recommended command:
  the resolved `{next-feature}` per that doc's standard lookup (first `TODO`/`FEATURE` in
  `.project/backlog.json`) — no offer if none exists.
- "Nee, later" — fall through to the Next-Step Clipboard Offer below.

`Nee` chosen (or the merge fails/is declined mid-review) → Apply the Next-Step Clipboard Offer
(binary Ja/Nee) — read `.claude/skills/shared/NEXT-STEP-OFFER.md`. Recommended command:
`/core-finalize security-hardening-{date}` — merges the worktree via `shared/FINALIZE.md`.
