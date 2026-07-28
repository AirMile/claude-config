---
name: game-ship
description: Run define→build→GUT-verify→playtest→refactor in one auto-mode flow. /game-ship.
reads:
  [
    feature.requirements,
    feature.build,
    feature.tests,
    backlog.status,
    backlog.stage,
    backlog.features,
    project-context.architecture,
    project-context.learnings,
    conventions,
  ]
writes:
  [
    feature.requirements,
    feature.files,
    feature.build,
    feature.tests,
    feature.playtestProfile,
    feature.seedDrift,
    backlog.stage,
    backlog.features,
    concept.seed,
    project-context.learnings,
  ]
writes-terminal: [feature.refactor, backlog.overview]
metadata:
  author: claude-config
  version: 0.9.6
  category: game
---

# Game Ship (auto-mode pipeline)

Runs the full Godot gamedev pipeline — **define → build → GUT auto-verify → human playtest → refactor** —
in one chat. Heavy work runs in isolated inline agents (context stays clean); only human interaction
(define choices, the live playtest) happens in the main chat; the autonomous PHASE 1–4 stretch runs
as background Workflows launched by the main chat, which wakes on their task-notifications.
`game-ship` is the **standalone** game pipeline: it carries its own vendored copies of the four phase
workflows under
`references/game-{define,build,verify,refactor}/` and drives them internally — there are no separate
`/game-define`…`/game-refactor` skills anymore.

**Trigger**: `/game-ship` or `/game-ship {feature-name}`

## When not to use this

- **1-3 files, no net-new surface** — `/game-tweak`. The plan-approval gate (PHASE 0 Step 4b) checks
  this itself against the completed define draft and offers the handoff when nothing escalates — see
  § Design's de-escalation-gate note below — but catching it before define opens the interview is
  cheaper still.
- **Tier-3 debug signals** (intermittent, cross-module, a prior fix already failed) — `/game-debug`,
  not a fresh define.
- **A parked run** — `/game-ship {feature-name}` again resumes it from the checkpoint; a fresh no-arg
  invocation starts a different feature instead.

## Design

- **Two human touchpoints**: PHASE 0 (define + plan-approval gate) up front, PHASE 3 (live playtest)
  mid-run **and its fix-plan gate**; everything else hands-off. Merge happens at the end of PHASE 4.
  The playtest classification (COVERED=GUT vs MANUAL=playtest) is advisory; AGENT 2's
  `remainingManualItems` is authoritative for PHASE 3.
- **De-escalation gate** — the plan-approval gate (Step 4b) runs the size-gate criteria from
  `shared/TWEAK-DISCIPLINE.md § Size gate` against the completed draft; none firing offers a fourth
  gate outcome, handoff to `/game-tweak`, alongside Accept/Reject/Abort. See
  `references/phase-0-define-classify.md § Step 4b` and
  `shared/TWEAK-DISCIPLINE.md § De-escalation gate`.
- **Difficulty escalation** — any main-chat decision point that turns out genuinely hard (triggers
  in `shared/PLAN-MODE.md § Difficulty escalation`: multi-approach architecture calls, twice-failed
  fixes, plan-invalidating surprises — e.g. choosing recovery after a `"failed"` workflow return)
  enters plan mode for the thinking, exits with the decision, and continues execution. Backstop
  only — the catalogued PHASE 0/3/4 gates keep their own entries.
- **Build and verify are separate agents/contexts** (fresh verify = adversarial). **`.project/` is
  shared on disk, context isolated** — sequential, one writer, re-read `.project/` after every agent
  return. See `references/agent-verify.md` / `references/non-interactive-contract.md`.
- **No game window in a subagent** — build + GUT auto-verify run **headless** (`gut_cmdln.gd`); a
  subagent has no display and must never call `mcp__godot-mcp__run_project`. The only interactive
  launch is the main chat's PHASE 3 playtest. **`{godot_executable}` is resolved once in PHASE 0** and
  injected into every agent slice (agents never re-resolve).
- **Agents run via the Workflow tool** (PHASE 1+2, PHASE 4), launched directly by the main chat;
  prompts passed **by pointer, never inline**; results schema-validated. Both workflow scripts
  **normalize `args`** at the top (`typeof args === "string" ? JSON.parse(args) : args`) — a runtime
  may deliver `args` as a JSON string. The Agent-tool path in each `agent-*.md` is the **fallback**
  (model override only there — it cannot set effort) — a background subagent cannot call the
  Workflow tool (not reachable even via `ToolSearch`), so the fallback is run by the main chat
  itself, never by an intermediate orchestrator agent.

  | Agent                 | Model    | Effort   | Why                                                                   |
  | --------------------- | -------- | -------- | --------------------------------------------------------------------- |
  | AGENT 1 build         | `sonnet` | `high`   | contract-driven TDD — feature.json + tests bound the work             |
  | AGENT 2 verify        | `opus`   | `high`   | the one independent adversarial GUT judgment; backstops build         |
  | AGENT 3 refactor      | `sonnet` | `medium` | GUT test-guarded (revert-on-red), low risk                            |
  | AGENT F fix (PHASE 3) | `sonnet` | `high`   | plan-bound fixes; the round gate did the thinking (Opus in plan mode) |

> Full rationale (two-touchpoint model, playtest 85/15, why fresh verify contexts, checkpoint
> durability, `.project/` sharing, prompt-by-pointer): `references/design-rationale.md`.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and
`completed` at the end. During context compaction the task list remains visible.

**Durable checkpoint (pause/resume across sessions)** — beyond the compaction-safe `TaskCreate` list,
the run is mirrored to `.project/session/ship-{feature}.json` at every phase boundary via
`ship-checkpoint.js` (use `pipeline: "game"`). **The main chat is the single writer throughout**
(worker subagents never touch it — contract rule 1). Schema, write points 0–5, and the board's
**parked** row: `shared/SHIP-CHECKPOINT.md`; resume detection, fast-path direct-resume, and
orphan-cleanup: `shared/SHIP-RESUME.md`. This skill follows both — the per-phase field patches below
are the only checkpoint detail restated here. Note the PHASE 2→3 boundary is a **deliberate handoff
stop**: park, then a fresh-session resume into the playtest when playtest items remain.

1. PHASE 0: Define + Classify + Auto-derive technique plan
2. PHASE 1: Build (AGENT 1)
3. PHASE 2: GUT auto-verify (AGENT 2)
4. PHASE 3: Human playtest + Completion
5. PHASE 4: Refactor (AGENT 3) + Finalize/merge
6. PHASE 5: Report

### PHASE 0: Define + Classify + Auto-derive technique plan

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred
> and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above).
> Mark PHASE 0 → `in_progress` via `TaskUpdate`. If the tools didn't resolve, skip seeding and
> continue.
> **Then route in two steps** (the resume path skips the fresh-run PHASE 0 file):
>
> 1. **Resume check first.** If `/game-ship` was called with an **explicit** `{feature}` arg and
>    `test -f .project/session/ship-{feature}.json` succeeds → Read
>    `.claude/skills/shared/SHIP-RESUME.md` and follow it. The fast path jumps straight to the
>    recorded phase (no prompt when explicit arg + matching pipeline + running + ≤ 24h) — so a parked
>    resume lands in PHASE 3 **without** loading `phase-0-define-classify.md`. (Only "Restart fresh"
>    falls through to step 2.)
> 2. **Fresh / no-arg / no checkpoint** → Read
>    `.claude/skills/game-ship/references/phase-0-define-classify.md` and follow it from Step 0 (it
>    resolves the feature name, delegates resume detection to `SHIP-RESUME.md`, then runs preflight +
>    define for a fresh run).

Resolves the feature, runs `game-define` inline (interactive, main chat) when it is not yet
DEFINED, then computes the advisory **playtest classification** (COVERED=GUT vs MANUAL=playtest) and
**auto-derives** the technique plan (refactor lenses) from the feature's signals — **no technique
menu, no policy prompt**. define is the only up-front human touchpoint; the derived `refactorLenses`
become parameters for AGENT 3 and are stored in memory for the later phases. PHASE 0 also resolves
`{godot_executable}` and injects it into every agent slice.

**OpusPlan-optimized.** The entire define thinking-block (interview → requirements → architecture →
classify → technique-derivation) runs **inside plan mode** — bookkeeping is hoisted before it, all
durable writes after it (gate-accept). Under `/model opusplan` the thinking runs on the planning model
(Opus) and execution (build/verify/refactor) on the execution model (Sonnet); on a single fixed model
it just adds structure. Confirmations are **not** asked twice — the interview keeps only genuine
decision prompts (feature pick, scene-layout forks, split), and everything else (scope, scene layout,
seed/backlog impact) is reviewed **once** at the gate, where reject loops back to revise.

PHASE 0 ends with the **plan-approval gate** (Step 4b of the reference): define is **already** in plan
mode, so the gate just writes the plan file (its appendix holds the complete feature.json draft) and
`ExitPlanMode` presents it — on **accept** the draft is extracted to `feature.json` (it is not written
before this) and the sync runs; **reject** stays in plan mode and loops back
to revise. A re-invoked feature that is already `DEFINED` means a prior run already accepted the gate,
so it skips define, plan mode, and the gate, flowing straight to build (the resume-recovery path).

PHASE 3 has a **second, conditional** plan-mode block (the fix-plan gate, `references/fix-round.md`)
with the same hoisted-bookkeeping shape — findings are collected and checkpointed first, the round's
fix design runs in plan mode (Opus), then `ExitPlanMode` gates dispatch. Unlike define, its input (the
findings ledger) is already durable before entry, so a cross-session death during the gate re-enters
the gate without re-running the walkthrough.

It also assembles **`SHIP_CONTEXT`** (Step 6 of the reference) — one project-context block built
here from the external `shared/GAME-CONTEXT-LOAD.md` (build profile) + `shared/LEARNINGS-LOAD.md`
(scoped). This block is passed as a **per-agent slice** (see the reference's Per-agent slices table)
into each PHASE 1/2/4 agent's **pointer file** — so no agent re-bootstraps its own context; the main
chat is the context-hub. Each `agent-*.md` § Spawn documents the pointer-file template that carries
this slice.

### PHASE 1–4: Orchestration (main chat, background workflows)

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`. Rewrite the board live-signal:
> `echo '{"skill":"build"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`,
> and **update the checkpoint** (`shared/SHIP-CHECKPOINT.md` atomic write): `phase: "PHASE 1"`,
> `completedPhases: ["PHASE 0"]`.
> Read `.claude/skills/game-ship/references/agent-build.md` and
> `.claude/skills/game-ship/references/agent-verify.md` (their **§ Spawn → Pointer file** templates
> only — do **not** read `non-interactive-contract.md` or the `references/prompts/*` bodies). **Write
> each pointer + SHIP_CONTEXT-slice file** — `.project/session/ship-prompts/{feature}-build.txt` and
> `-verify.txt` — keeping the literal `{worktreePath}` placeholder in the verify file, and pass the
> **paths** (never inline). This stays main-chat work: the main chat holds `SHIP_CONTEXT` (including
> the resolved `{godot_executable}`) in memory from PHASE 0.
>
> Read `.claude/skills/game-ship/references/orchestration.md` and follow it — launch the PHASE 1+2
> workflow (§3) with the two pointer paths above. **End the turn** with a one-liner ("Shipping
> `{feature}` in the background — I'll report when it returns.") — no further tool calls.
>
> **On workflow notification**, branch on the returned `status`:
>
> - **`"complete"`** → proceed to PHASE 5.
> - **`"parked"`** (playtest items remain) → print the handoff message below — no further tool calls.
>   PHASE 3/4/5 run in a fresh session. Emit it in the runtime language (LANGUAGE.md); this template
>   is the English source:
>   ```
>   PHASE 1+2 green — {testsTotal} tests pass, {N} playtest items remain.
>   To keep this chat cheap, the run stops here — checkpoint ready.
>
>   → Run /clear (or open a new chat), then: /game-ship {feature}
>     Lands directly in the playtest round (worktree + game window
>     relaunch automatically).
>
>   The board shows this run as parked (⏸) with the same resume button.
>   Prefer to continue here? Say so and I'll run PHASE 3 in this session.
>   ```
>   **Same-session escape hatch**: if the user replies "continue here" (or equivalent), continue
>   with `orchestration.md § 4` (PHASE 3 completion) inline in this chat instead of parking.
> - **`"failed"`** → print, depending on `failedPhase`, then proceed to PHASE 5's failure path:
>   - `"build"`: "Build failed at `{build.failedAt}`, worktree intact at `{build.worktreePath}` — run
>     `/game-debug {feature}`, or re-run `/game-ship {feature}` to resume."
>   - `"verify"`: "GUT auto-verify failed at `{verify.failedAt}`, worktree intact — run
>     `/game-debug {feature}`, or re-run `/game-ship {feature}` to resume."

You run both agents sequentially in isolated contexts (model/effort matrix in § Design), launch
PHASE 4's refactor/finalize when no playtest items remain, and continue to PHASE 5. Full mechanics:
`references/orchestration.md`. Full agent behaviour: `agent-build.md` / `agent-verify.md` /
`agent-refactor.md`.

### PHASE 3: Human playtest + Completion (MAIN CHAT — fresh-session playtest round)

> **Todo**: mark PHASE 3 → `in_progress` (PHASE 1+2 were already flipped on the workflow return).
> Rewrite the board live-signal: `echo '{"skill":"test"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`
> (cwd-in-worktree safe — the script resolves main-root itself, same as the checkpoint write), and
> update the checkpoint `phase: "PHASE 3"`.
> You arrive here with non-empty `remainingManualItems`, normally **from a fresh session** (the
> `"parked"` handoff above) via the reference's **Resume entry** note — re-enter the worktree +
> relaunch the game window first — or from the same-session **escape hatch** (the user chose to
> continue here instead of parking). Either way re-arm the live signal, then proceed: Read
> `.claude/skills/game-ship/references/phase-3-playtest.md` and run the live playtest walkthrough
> then the completion (DONE write).

The playtest runs in the main chat so `AskUserQuestion` and the live game window (via
`mcp__godot-mcp__run_project` on `playtest_scene.tscn`) reach the real user. The reference owns the
full routing — item-by-item walkthrough + interview close → findings ledger (checkpoint) →
conditional round-level fix-plan gate (mirrors PHASE 0's gate) → fix dispatch via
`references/workflows/ship-game-fix.js` + inline mix → re-check round → GUT regression re-run. On
all-green complete the feature (DONE write) and **stay in the worktree**; finalize/merge runs at the
end of PHASE 4 so refactor commits land on the feature branch. **No refactor/finalize until failed
items pass.** Once complete, continue per `references/orchestration.md` (the checkpoint's `route`
subcommand sends you straight to PHASE 4) and handle its notification as described in § PHASE 1–4
above.

### PHASE 5: Report

> **Todo**: mark the phases that actually ran → `completed` (on a failure-jump, leave the failed
> phase `in_progress` and never mark a skipped phase `completed`), PHASE 5 → `in_progress`.
> **Board cleanup** (every exit path, success or failure): `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`,
> and if the feature still exists in `backlog.json#features[]` with `transition: "shipping"`, remove
> that `transition`. **On full success the feature is no longer in `features[]` at all** — refactor's
> completion-batch shipped it and moved it to `backlog-archive.json`, verified by PHASE 4's post-merge
> reconcile — so **never treat absence from `features[]` as data loss** (do not re-add the entry). The
> `transition`-strip here is only for failure-jumps and the `--no-refactor` escape hatch, where the
> feature is still present.
> **Checkpoint cleanup** — asymmetric with the board signal (per `shared/SHIP-CHECKPOINT.md`): on a
> green completion set the checkpoint `status: "complete"` then `rm -f .project/session/ship-{feature}.json`.
> On a **failure-jump, leave the checkpoint on disk** (`status: "failed"`) so `/game-ship {feature}`
> can resume; surface its `baselineSha` in the failure report as the rollback anchor.

Print the ship summary (ASCII table): feature, build test counts, GUT auto-verify results, playtest
outcomes, refactor result, second-opinion consults, and the collected `autoDecisions[]` (choices
the agents auto-made in non-interactive mode) for your review. All fields come from the
checkpoint's `results` (and, on the playtest path, the in-context PHASE 3 walkthrough).

```
SHIP COMPLETE: {feature}
========================
Plan:      auto-derived → lenses {refactorLenses}
Build:     {passed}/{total} GUT PASS
Verify:    COVERED {n} GUT PASS · MANUAL {n} ({pass}/{fail}/{tweak}/{skip}/{defer}) · {rounds} fix round(s)
Refactor:  {lenses applied} · {improvements} applied ({reverted} reverted)
Consult:   {none | "{context}: consulted ({trigger})" | "{context}: consulted ({trigger}) → revised" | "{context}: unavailable"}
Merged:    {yes → main | no → {reason}}

Auto-decisions ({N}):
- {agent}: {decision} → chose {choice}
```

**Ship-level learning extraction** (the layer the agents cannot see — game-ship owns it). The copied
build/verify/refactor already wrote their **domain** learnings during their phases (do not re-write
those). But cross-phase, ship-level signals only exist in the main chat — extract a small set (0-3)
to `project-context.json#learnings[]` via `shared/LEARNING-WRITE.md` (`source: "extracted"`,
same dedup): a recurring `autoDecisions` pattern, playtest friction (an item that repeatedly needed a
human), or a refactor improvement the GUT test-guard **reverted** (signals a fragile pattern).
Only write genuinely reusable signals — skip if none.

**Memory consolidation** (so future `game-ship` runs have insight). This step then runs the
consolidation gate per `shared/LEARNING-WRITE.md § Consolidation Gate` (trigger `> 60` →
merge per-feature clusters, archive originals, target ≤40). Archived entries stay **searchable by
relevance** (the loader scans the archive as a damped tier), so consolidation shrinks the active
list without losing recall. This closes the loop: the next `game-ship` run's PHASE 0 `SHIP_CONTEXT`
preloads the relevant learnings via `shared/LEARNINGS-LOAD.md`.

> **Todo**: mark PHASE 5 → `completed`.

On any agent failure earlier in the flow, PHASE 5 still runs but reports the stop point and the
recovery command (`/game-debug {feature}`) instead of a green summary.
