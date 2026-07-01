---
name: dev-ship
description: Use to run define→build→verify→refactor as one auto-mode flow. Use with /dev-ship.
reads:
  [
    feature.requirements,
    feature.architecture,
    feature.build,
    feature.tests,
    feature.verificationProfile,
    backlog.status,
    project-context.learnings,
    conventions,
  ]
writes: [feature.verificationProfile, project-context.learnings]
metadata:
  author: claude-config
  version: 0.1.0
  category: dev
---

# Ship (auto-mode pipeline)

Runs the full dev pipeline — **define → build → verify → refactor** — in one chat. Heavy work
runs in isolated inline agents (context stays clean); only human interaction (define choices,
manual tests) happens in the main chat. Does **not** replace the classic 4-skill pipeline — it
orchestrates the existing skills via reuse. Old `/dev-define`→`/dev-build`→… stay untouched.

**Trigger**: `/dev-ship` or `/dev-ship {feature-name}`

## Design

- **One human touchpoint up front** (PHASE 0: define + technique selection), then hands-off —
  except the conditional manual-test interlude (PHASE 3).
- **85/15 is one flow, not two paths.** PHASE 3 either has manual items or falls through to just
  the merge. The `verificationProfile` computed in PHASE 0 is an **advisory estimate**; AGENT 2's
  returned `remainingManualItems` is authoritative for PHASE 3.
- **Build and verify are separate agents (separate context windows)** — a fresh verify agent is
  unbiased/adversarial, which is the whole value of verify. See `references/agent-verify.md`.
- **`.project/` is shared on disk between agents; context is isolated.** The flow is sequential →
  one writer at a time → no write-races. Re-read `.project/` from disk after every agent return.
  See `references/non-interactive-contract.md`.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and
`completed` at the end. During context compaction the task list remains visible.

1. PHASE 0: Define + Classify + Technique menu
2. PHASE 1: Build (AGENT 1)
3. PHASE 2: Auto-verify (AGENT 2)
4. PHASE 3: Manual tests + Finalize/merge
5. PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S]
6. PHASE 5: Report

### PHASE 0: Define + Classify + Technique menu

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred
> and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above).
> Mark PHASE 0 → `in_progress` via `TaskUpdate`.
> Read `.claude/skills/dev-ship/references/phase-0-define-classify.md` and follow it.

Resolves the feature, runs `dev-define` inline (interactive, main chat) when it is not yet
DEFINED, then computes the advisory `verificationProfile` and presents the auto-suggested technique
menu (refactor lenses + relevant OWASP categories + refactor policy). Selections become parameters
for AGENT 3 and the trigger for AGENT S — they are stored in memory for the later phases.

It also assembles **`SHIP_CONTEXT`** (Step 6 of the reference) — one project-context block built
here from the external `shared/PROJECT-CONTEXT-LOAD.md` (build profile) + `shared/LEARNINGS-LOAD.md`
(scoped). This block is passed as a **per-agent slice** (see the reference's Per-agent slices table) into
each PHASE 1/2/4 agent prompt — AGENT S gets `OWASP_CONTEXT` instead — so no agent
re-bootstraps its own context; the main chat is the context-hub. The agent references already carry
the `{paste the SHIP_CONTEXT block …}` slot.

### PHASE 1: Build (AGENT 1)

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`. Read
> `.claude/skills/dev-ship/references/agent-build.md` and
> `.claude/skills/dev-ship/references/non-interactive-contract.md`, then spawn AGENT 1.

AGENT 1 runs `dev-build` non-interactively in an isolated context: creates the worktree, builds
test-first, commits — but **never merges**. Parse `SHIP_BUILD_RESULT_START/END` from its return.
On build failure: stop the flow, leave the worktree, report + suggest `/dev-debug`.
**Re-read `.project/` from disk** before continuing.

### PHASE 2: Auto-verify (AGENT 2)

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`. Read
> `.claude/skills/dev-ship/references/agent-verify.md`. **Before spawning**, rebuild the
> **verify-slice** from the just-read `.project/` (fresh learnings/architecture that build added) and
> fill in the worktree path from AGENT 1. Then spawn AGENT 2 (fresh context).

AGENT 2 runs `dev-verify` for the AUTO/COVERED items only, in a **fresh context** (unbiased), in
the existing worktree — and **stops before PHASE Finalize** (never merges). Parse
`SHIP_VERIFY_RESULT_START/END`; the returned `remainingManualItems` is authoritative for PHASE 3.
On unrecoverable auto-verify failure: stop, leave worktree, report + `/dev-debug`.
**Re-read `.project/` from disk** before continuing.

### PHASE 3: Manual tests + Finalize/merge (MAIN CHAT)

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. If AGENT 2 returned
> `remainingManualItems` (non-empty) → Read
> `.claude/skills/dev-ship/references/phase-3-manual-finalize.md` and run the manual walkthrough
> then finalize. If empty → Read the same file and execute Step 1 (enter worktree) then Step 3
> (Completion + Finalize, **both** items — the completion-sync DONE write and the finalize/merge);
> skip only Step 2 (the manual walkthrough).

Manual tests run in the main chat (you), so `AskUserQuestion` reaches the real user. On all-green
(or empty), finalize = merge + remove worktree via the reused `dev-verify` finalize flow. On a
manual FAIL: do not finalize, do not refactor — report + hand to `/dev-debug`/`/dev-verify`.

### PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S]

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. If
> `SHIP_PLAN.refactorPolicy == skip` → do not spawn AGENT 3 (AGENT S may still run if
> `securityDeep` is non-empty) and continue to PHASE 5. Otherwise Read
> `.claude/skills/dev-ship/references/agent-refactor.md`. **Before spawning**, rebuild the
> **refactor-slice** from the just-read post-merge `.project/` (built files + fresh learnings). Then
> spawn AGENT 3 (post-merge, on main).
> If the PHASE 0 technique menu selected a deep OWASP audit → also Read
> `.claude/skills/dev-ship/references/agent-security.md` and spawn AGENT(S) S (may run parallel to
> AGENT 3 — read-only, no `.project/` writes).

AGENT 3 runs `dev-refactor` on this single feature with the selected lenses and policy
(`conservative` default), test-guarded. Parse `SHIP_REFACTOR_RESULT_START/END`. AGENT S (if any)
reports security findings only — **no auto-fix in hands-off**; surface findings in PHASE 5.
**Re-read `.project/` from disk** before continuing.

### PHASE 5: Report

> **Todo**: mark the phases that actually ran → `completed` (on a failure-jump, leave the failed
> phase `in_progress` and never mark a skipped phase `completed`), PHASE 5 → `in_progress`.

Print the ship summary (ASCII table): feature, build test counts, verify results, manual outcomes,
refactor result, security findings (if any), and the collected `autoDecisions[]` (choices the
agents auto-made in non-interactive mode) for your review.

```
SHIP COMPLETE: {feature}
========================
Build:    {passed}/{total} PASS
Verify:   AUTO {n} PASS · MANUAL {n} ({pass}/{fail}/{skip}/{defer})
Refactor: {lenses applied} · {techniques} applied ({reverted} reverted)
Security: {findings count or "not run"}
Merged:   {yes → main | no → {reason}}

Auto-decisions ({N}):
- {agent}: {decision} → chose {choice}
```

**Ship-level learning extraction** (the layer the agents cannot see — dev-ship owns it). The copied
build/verify/refactor already wrote their **domain** learnings during their phases (do not re-write
those). But cross-phase, ship-level signals only exist in the main chat — extract a small set (0-3)
to `project-context.json#learnings[]` via `shared/LEARNING-EXTRACTION.md` (`source: "extracted"`,
same dedup): a recurring `autoDecisions` pattern, manual-test friction (an item that repeatedly
needed a human), or a refactor technique the test-guard **reverted** (signals a fragile pattern).
Only write genuinely reusable signals — skip if none.

**Memory consolidation** (so future `dev-ship` runs have insight). This step then runs the
consolidation gate: read `project-context.json#learnings[]`; if `length > 60`, archive the
oldest entries to `.project/archive/learnings-{YYYY-MM}.json` and keep the active list ≤40 (per
`shared/LEARNING-EXTRACTION.md` § consolidation). This closes the loop: the next `dev-ship` run's
PHASE 0 `SHIP_CONTEXT` preloads these learnings via `shared/LEARNINGS-LOAD.md`.

> **Todo**: mark PHASE 5 → `completed`.

On any agent failure earlier in the flow, PHASE 5 still runs but reports the stop point and the
recovery command (`/dev-debug {feature}`) instead of a green summary.
