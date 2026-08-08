# Report (final phase — read by both `/dev-ship` and `/dev-manual`)

Shared by both skills' final phase (`dev-ship/SKILL.md` PHASE 5; `dev-manual/SKILL.md` MANUAL 3) —
whichever one is running this ship to completion runs this exact step; only its own `TaskUpdate`
phase-marker calls differ (PHASE 5 vs M3), everything else below is identical.

> **Todo**: mark the phases that actually ran → `completed` (on a failure-jump, leave the failed
> phase `in_progress` and never mark a skipped phase `completed`), this final phase → `in_progress`.
> **Board cleanup** (every exit path, success or failure): `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`,
> and if the feature still exists in `backlog.json#features[]` with `transition: "shipping"`, remove
> that `transition`. **On full success the feature is no longer in `features[]` at all** — refactor's
> completion-batch shipped it and moved it to `backlog-archive.json`, verified by PHASE 4's post-merge
> reconcile — so **never treat absence from `features[]` as data loss** (do not re-add the entry). The
> `transition`-strip here is only for failure-jumps and the `--no-refactor` escape hatch, where the
> feature is still present.
> **Checkpoint cleanup** — asymmetric with the board signal (per `shared/SHIP-CHECKPOINT.md`): on a
> green completion set the checkpoint `status: "complete"` then `rm -f .project/session/ship-{feature}.json`.
> On a **failure-jump, leave the checkpoint on disk** (`status: "failed"`) so `/dev-ship {feature}`
> (or `/dev-manual {feature}`, same result) can resume; surface its `baselineSha` in the failure
> report as the rollback anchor.

**Security auto-todo** (only when `results.triage.confirmed` is non-empty — read from the ship-triage
file `orchestration.md § 5` just persisted, not the about-to-be-deleted checkpoint): if it contains
≥1 finding with `severity: "critical"` or `"high"`, auto-create a backlog todo — deliberately without
an `AskUserQuestion` (a confirmed CRITICAL/HIGH security finding is not optional to surface, unlike
the Smart-Todo Creation pattern's usual confirm-first flow, `shared/SKILL-PATTERNS.md § Smart
Suggestions`). Dedup first (`shared/BACKLOG.md § Writing the backlog` name check): if
`data.features.find(f => f.name === "security-{feature}")` already exists and is open, skip creation
and log one line instead. Otherwise push to `backlog.json#data.features[]`:

```json
{
  "name": "security-{feature}",
  "type": "SECURITY",
  "status": "TODO",
  "phase": "P1",
  "description": "{X} CRITICAL / {Y} HIGH confirmed by ship security triage. Findings: .project/security/ship-triage-{feature}.json. Remediate via /dev-security {feature}.",
  "source": "/dev-ship",
  "parentFeature": "{feature}"
}
```

Then patch `backlogTodo: "security-{feature}"` into the ship-triage file.

Print the ship summary (format: `shared/OUTPUT.md § Report Block`, max 72 chars per line —
the template below conforms; wrap filled-in values rather than running long): feature, build
test counts, verify results, manual outcomes, refactor result, security findings (if any),
second-opinion consults, and the collected `autoDecisions[]` (choices the agents auto-made in
non-interactive mode) for your review. All fields come from the checkpoint's `results` (and,
on the manual path, the in-context PHASE 3 walkthrough).

**Deviations** — distinct from `autoDecisions[]` (in-spec judgment calls the agents made where
the skill left a choice open): a deviation is anywhere the main chat itself did something the
skill prescribes differently — an AskUserQuestion gate bypassed, a step executed weaker than
written, a recovery procedure improvised because none was documented. Track these as they
happen through PHASE 1-4 and list them here; omit the `Deviations:` block entirely when none
occurred.

```
SHIP COMPLETE: {feature}
========================
Plan:     auto-derived → lenses {refactorLenses}
          · security {securityDeep or "none"}
Build:    {passed}/{total} PASS
Verify:   AUTO {n} PASS · MANUAL {n}
          ({pass}/{fail}/{tweak}/{skip}/{defer}/{accepted})
          {" · {k} unproven" when any evidence-class Pass carries
          evidence:"none"; omit when k=0}
          · {rounds} fix round(s) · {debug escalation count}
Refactor: {lenses applied} · {techniques} applied
          ({reverted} reverted)
Security: {confirmed} confirmed · {dismissed} dismissed {suffix}
Consult:  {context}: consulted ({trigger}) {suffix}
Merged:   {yes → main | no → {reason}}
De-escalation overridden: tweak-sized ({N} files, no net-new surface)

Auto-decisions ({N}):
- {agent}: {decision} → chose {choice}

Deviations ({N} — omit block when N=0):
- {what the skill prescribed} → {what actually happened} ({location})
```

Value notes (keep out of the fence per `shared/OUTPUT.md § Report Block`): the `unproven`
count comes from `manual.items[].evidence === "none"` — the same soft-gate signal the
walkthrough's own routing summary already surfaces (`phase-3-manual-finalize.md § Findings
ledger + routing`); repeat it here so it isn't dropped between the two points the policy
requires it at. The debug escalation count appears only when this run used
`debug-round.md`/`debug-round-heavy.md` — fix rounds and debug escalations are separate
counters that don't compose into one number.
`Security:` takes suffix `→ persisted + todo security-{feature}` when the auto-todo fired,
`→ persisted` when below the threshold, or reads `not run`. **When `results.triage`
carries a non-empty `scannersFailed[]`** (`ship-phase4.js` returns it — see
`orchestration.md`'s write point 3), append ` · {N} scanner(s) failed:
{codes}` — without it a half-failed scan reads exactly like a clean one, and the
`confirmed`/`dismissed` counts silently under-report. `Consult:` takes suffix
`→ revised` when the consult changed an outcome, `→ confirmed` when it didn't, `sparred (2
rounds) → revised/confirmed` when a round-2 rebuttal fired, or reads `none` /
`{context}: unavailable` (`shared/SECOND-OPINION.md § Logging` is authoritative for the full
value set).
`De-escalation overridden: ...` prints only when Step 4b's plan-approval gate found the
completed draft tweak-sized and Accept was chosen anyway (`shared/TWEAK-DISCIPLINE.md §
De-escalation gate` (b)) — omit the line entirely when the gate never fired, or fired and
De-escalate was chosen instead (that path hands off to `/dev-tweak` and never reaches this
report).

Then print a `Next steps:` numbered block — markdown, **after** the fence so `/commands`
stay clickable (`shared/SKILL-PATTERNS.md § Next Steps`). Success path: `1. /project-plan —
pick the next feature`, plus `/dev-tweak {card}` when this run offloaded TWEAK cards. When
the security auto-todo fired (≥1 confirmed HIGH/CRITICAL finding), list `/dev-security
{feature}` as step 1 instead, ahead of `/project-plan` — a confirmed HIGH/CRITICAL finding
outranks picking up the next feature.
Failure path: the recovery options from the failure paragraph below, resume command first.

**Ship-level learning extraction** (the layer the agents cannot see — dev-ship owns it). The copied
build/verify/refactor already wrote their **domain** learnings during their phases (do not re-write
those). But cross-phase, ship-level signals only exist in the main chat — extract a small set (0-3)
to `project-context.json#learnings[]` via `shared/LEARNING-WRITE.md` (`source: "extracted"`,
same dedup): a recurring `autoDecisions` pattern, manual-test friction (an item that repeatedly
needed a human), or a refactor technique the test-guard **reverted** (signals a fragile pattern).
Only write genuinely reusable signals — skip if none.

**Memory consolidation** (so future ship runs have insight). This step then runs the
consolidation gate per `shared/LEARNING-WRITE.md § Consolidation Gate` — that section owns the
trigger; empty output is the normal no-op, not a broken script. Archived entries stay **searchable by
relevance** (the loader scans the archive as a damped tier), so consolidation shrinks the active
list without losing recall. This closes the loop: the next ship run's PHASE 0 `SHIP_CONTEXT`
preloads the relevant learnings via `shared/LEARNINGS-LOAD.md`.

> **Todo**: mark this final phase → `completed`.

On any agent failure earlier in the flow, this phase still runs but reports the stop point and the
recovery options (re-run `/dev-ship {feature}` or `/dev-manual {feature}`, or
`references/debug-round-heavy.md` directly) instead of a green summary.
