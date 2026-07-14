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

On return: persist `plans` into the audit state (`orchestration.md § 3`'s "On return" step already
covers this).

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

AskUserQuestion — header: "Fix Strategy", question: "Which fix strategy do you want to apply?":

- "Pragmatic (Recommended)" — CRITICAL + HIGH, good balance
- "Minimal" — CRITICAL only, lowest risk
- "Extensive" — Everything, including preventive measures

Then present the chosen plan's fix list numbered, ask: "Which fixes do you want to apply? Provide
numbers (e.g. `1, 3` or `all`)." Parse → fix-set.

`ExitPlanMode` once the fix-set is chosen — present the chosen strategy + selected fixes as the plan
output. Rejected → stay in plan mode, revise, re-present, loop until accepted.

## Worktree

After accept, run `shared/WORKTREE-CREATE.md § Auto-create` with feature-name
`security-hardening-{YYYYMMDD}` (today's date; the dirty-work guard and collision matrix apply
unchanged — this is a real code-mutating skill phase, same as any build PHASE 0).

**Caveat — `.project/security/` is not in the worktree's shared-symlink list**
(`shared/WORKTREE.md § What to share` only symlinks `backlog.json`/`features`/`project.json`/
`project-context.json`/`wireframes`/`screenshots`/`thinking`). Every audit-state write from this
point on must go to `{MAIN_ROOT}/.project/security/...` — `MAIN_ROOT` was resolved and stored in the
audit state at PHASE 1 (`SKILL.md § PHASE 1`'s audit-state creation step); reuse it rather than
re-deriving cwd-relative paths from inside the worktree.

Patch the audit state's `worktree` field to `{ path: "{WT_PATH}", branch: "security-hardening-{date}" }`
once created.

Skip Step 3's `ship-checkpoint.js signal` call from `WORKTREE-CREATE.md` — the audit-state file is
this skill's own resume signal (PHASE 1), not a ship-pipeline checkpoint; there is no
`active-security-hardening-{date}.json` board row to maintain.

## Implement

Apply the chosen strategy's selected fixes in the worktree. Per fix: show file:line, apply the
change, verify syntax. Run the project's test suite if one exists (detect from `package.json` /
project convention — same detection `debug-round-heavy.md § 7` uses). Commit on the worktree branch:

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

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read `.claude/skills/shared/NEXT-STEP-OFFER.md`.
> Recommended command: `/core-finalize security-hardening-{date}` — merges the worktree via
> `shared/FINALIZE.md`. Do **not** auto-merge here; the user reviews the diff first.
