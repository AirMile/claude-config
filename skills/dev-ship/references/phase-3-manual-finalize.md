# PHASE 3 — Manual tests + Completion (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` reaches the real user. Resumes the half of `dev-verify`
that AGENT 2 deliberately skipped: the manual walkthrough (if any) and the DONE completion.
Finalize/merge has moved to the end of PHASE 4 (after refactor) so refactor commits land on the
feature branch first. AGENT 2's `remainingManualItems` is authoritative here.

**Dual reader**: this file is read by the main chat on both paths — the manual-items path (below),
and the no-manual path (`references/orchestration.md § 4`), which runs only **Step 1** + **Step 3**,
never Step 2 (no app launch, no walkthrough — this route only fires when there's nothing to show a
human) and never the routing sections below (those assume manual items).

## Resume entry (fresh session)

When PHASE 3 is entered via a direct resume (a fresh chat re-invoking `/dev-ship {feature}` after the
last session handed off here — the deliberate token break after auto-verify leaves manual items, the
common case — or was interrupted), `results.verify` comes from
the checkpoint (`ship-{feature}.json`), not from an in-context AGENT 2 return. Run **Step 1** (enter
the worktree) and **Step 2** (launch the app via the App-launch rule) exactly as on the normal path,
then route **per open item** in the following precedence order (highest first — check 1 before 2,
2 before 3, and so on; a resume typically finds only one kind of open work, but if the ledger has
several items at different stages, e.g. one still mid-dispatch while another already escalated,
handle each via its own highest-matching bullet):

1. **Item has `heavyRoundFailed: true`** (still open — cleared once resolved) → resume directly at
   `debug-round-heavy.md § 8`'s re-check. The fix plan already exists; nothing to redesign.
2. **Item has `debugTier: "heavy"`** (and not `heavyRoundFailed`) → go straight to
   `references/debug-round-heavy.md § 1` for that item (`debug-round.md § 8` escalated it there).
3. **Item has `debugTier: "light"` AND a non-empty `lightRoundNotes`** → a light round already ran
   to completion (the notes read as investigation + hypothesis + fix + re-check, not a bare park) —
   the `debugTier: "heavy"` write was interrupted before landing. Treat it as already escalated: go
   straight to `references/debug-round-heavy.md § 1`, and first patch `debugTier: "heavy"` to
   correct the record.
4. **Item has `debugTier: "light"`** (no `lightRoundNotes` yet) → go straight to
   `references/debug-round.md § 1` for that item (`fix-round.md § Re-check` parked it there) — its
   evidence is already durable in the ledger, nothing is re-asked.
5. **`manual.fixPlan` present and `activeWorkflow: "phase3fix"`** (a dispatch was in flight) → go to
   `fix-round.md § Dispatch` and relaunch `ship-fix.js` with `resume` built from `manual.dispatch`
   (cross-session) or `resumeFromRunId` (same session, per `shared/SHIP-RESUME.md`).
6. **`manual.fixPlan` present, dispatch complete (`manual.dispatch.allFixed` or all groups
   terminal), and ≥1 item from that round has no `verdict: "pass"` or `"accepted"` yet and no
   `debugTier` set** →
   go to `fix-round.md § Re-check` for those still-open items (checks 1–3 already claimed any item
   that re-check has already escalated on a prior pass — this bullet only fires for the ones it
   hasn't reached yet).
7. **Ledger complete (`manual.items` covers every item, `manual.interviewDone: true`) but no
   `manual.fixPlan`** → go straight to `§ Findings ledger + routing` below and re-enter the fix-plan
   gate (the ledger is durable, so the walkthrough never re-runs — only the round's fix-plan draft was
   lost, same as a rejected-and-abandoned plan would be).
8. **No `manual` block, or `manual.items` shorter than `results.verify.remainingManualItems`** →
   run the walkthrough (`manual-interview-walkthrough.md`), filtering `remainingManualItems` down to
   the items **not yet present** in `manual.items` (already-verdicted items are not re-asked). The
   walkthrough's Step A re-arms `active-{feature}.json` with `waiting: "manual-tests"`, so the board
   flips the row from **parked** back to **waiting**. (Vacuously lowest precedence — no item can have
   a `debugTier` or verdict before the ledger exists.)

Keep the checkpoint `phase: "PHASE 3"` throughout.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md § Switch into existing worktree`
with `feature-name = {feature}` and `feature.status = DOING`. This switches to `worktree-{feature}`
(needed for the dev-server /
Playwright daemon that the walkthrough uses) and runs the symlink-integrity gate.

> **Gate scope:** only the 4 required symlinks (`backlog.json`, `features`, `project.json`,
> `project-context.json`) gate the switch. `wireframes`/`screenshots`/`thinking` may dangle safely
> (their source dirs don't always exist in main) — do **not** abort the gate on those.

## Step 2 — Manual walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the 85% case) — go
straight to Step 3.

**Launch the app + hand off — don't block on a readiness grep.** Start the app in the background,
then **hand the first item to the user immediately** and let them confirm when the window is up:
_a manual test is verified by the human, not by a log line — the person at the window is the
readiness signal._ Never make the user wait on your own "is it ready yet" check.

> **STOP — launch command shape.** `run_in_background: true` already backgrounds the whole
> command. Do **not** also append a trailing shell `&`/`disown` — that double-backgrounds the
> process, and the tool reports the launch itself as "completed" while the app keeps running,
> which reads as a crash and costs a clarifying round.
>
> - Wrong: `Bash({command: "npm run tauri dev & disown", run_in_background: true})`
> - Right: `Bash({command: "npm run tauri dev", run_in_background: true})`

> **STOP — confirm the fix is actually loaded before asking for a re-check.** After editing a file
> during a fix/debug round with the app already running, grep the dev-server's background output
> for an HMR/rebuild line naming that file before handing the item back to the user. No matching
> line (or a full-reload/compile-error line instead) → kill and relaunch the app before asking —
> never hand off a re-check against code the running instance hasn't actually picked up.

**App-launch rule — launch what the manual item actually needs, from the project's OWN run config.**
A hard rule, not a judgment call: a slow compile or a heavier process is **never** a reason to
substitute a lighter command that cannot exercise the item under test.

**Source the launch command from the project — don't hardcode `npm run dev`.** Resolve it lazily, in
this order, first hit wins (so you read only what this project needs): (a) a project-local run skill
or the built-in `run` skill's pattern for the detected type — it is the canonical launcher, prefer it
over re-deriving; (b) the project `CLAUDE.md` **Commands** table; (c) `package.json#scripts` /
`project.json#stack`. Launch the command the project declares for its own shell.

**Then match that command to what the item exercises:**

- **Native-shell app** (Tauri: a `src-tauri/` dir or `tauri` script; Electron: an `electron`
  dep/script) → launch the **desktop** command (`npm run tauri dev`, the electron dev script).
  **Never substitute the frontend-only dev server** (`npm run dev` / bare `vite`) to skip the
  compile: the browser serves the UI but the native runtime is absent — Tauri's
  `@tauri-apps/plugin-fs|dialog|store`, Electron's IPC/`fs` are `undefined` there — so any item that
  opens a file, reads disk, or hits a native API is **impossible** in the browser and gets
  force-skipped (the exact failure this rule prevents). The compile is slow; tell the user it is
  building and wait.
- **Web app** → the project's declared web dev script IS the app, but be smart about the item's
  needs: if it exercises an **API / SSR / auth / DB** path and the frontend dev server does not also
  start the backend, launch the backend too (a monorepo `dev` that runs both, or the separate
  api/server script) — a frontend-only server force-skips API-dependent items the same way a browser
  force-skips native ones. A pure client-side UI item needs only the dev server.
- **CLI / TUI / server-only / library** → no window: drive it as the `run` skill's pattern for that
  type does (run the binary, start the server, exercise the export) and hand the user the concrete
  command + expected output instead of a URL.

Principle: **the lighter command is acceptable only when it can actually exercise the item.** If a
manual item touches a capability the lighter command does not provide (native runtime, backend, SSR),
launch the heavier one — the only cost is startup time, whereas the wrong launch wastes the whole
manual round. When unsure, launch the fuller shell.

**Git-manipulating feature → check for a worktree branch-name collision first.** If the feature
under test itself performs branch operations (switch/create/merge), the app's project selection may
be the very repo this ship is running in — and its other local branches may already be claimed by
`.claude/worktrees/*` (git refuses to check out a branch that's checked out elsewhere). Run `git
worktree list` before presenting item 1; if the only other branches are worktree-claimed, set up a
disposable scratch git repo (a few plain branches, a deliberately colliding file for a merge-conflict
item) instead of discovering the blocker mid-item.

**If the app under test has its own persisted project/workspace selection** (a canvas/IDE-style app,
a multi-project tool) — its active project may not be the worktree the dev server serves from.
Before creating any test fixture file (e.g. for a read-only-file or permission-error scenario),
verify which path the running app actually has open (its own settings/store, not an assumption
that "the worktree" == "what the app shows") — a fixture written to the wrong path silently never
appears in the app and costs a full extra round to diagnose.

> If you genuinely must detect readiness programmatically (e.g. to auto-open a browser tab), it MUST
> (a) tolerate ANSI color codes — match the bare word (`grep -aE "Running|Finished|error"`), never a
> literal `Running \`space\`…`pattern, because Cargo/Vite wrap words in ANSI escapes so "Running" is
followed by an escape, not a space; and (b) use a **bounded** wait (a `run_in_background` `until`loop with a timeout / fixed poll count) that falls back to surfacing to the user — never an
unbounded`until` that can hang forever on a signal that never arrives.

Then run the **item-by-item interview walkthrough**: Read
`.claude/skills/dev-ship/references/manual-interview-walkthrough.md` and execute it for the
`remainingManualItems` from AGENT 2 — the walkthrough enters plan mode before the first item (Step
A3), items are presented one at a time, each judged live, non-pass verdicts get their detail
captured immediately, and a closing interview asks what else should be different or better.
**Nothing is fixed during this walkthrough** — it only builds the findings ledger, collected in
memory and batch-persisted to the checkpoint right after the `ExitPlanMode` named below (so a killed
session resumes mid-walkthrough at the last **persisted** item, per § Resume entry).

## Findings ledger + routing

You are still inside the walkthrough's plan mode here — this routing decision determines **which**
`ExitPlanMode` closes it. Route on the accumulated in-memory ledger (`manual.items` + any
interview-close findings):

| Ledger state                                                                             | Route                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Fail/Tweak findings (all Pass, or only Skip/Defer)                                    | `ExitPlanMode` now (short summary, e.g. "all N items pass — {k} unproven" when any evidence-class Pass carries `evidence: "none"`; omit when k = 0) → batch-persist (walkthrough § Step E) → Regression re-check → Step 3 |
| ≤2 findings, all MEASURABLE, cosmetic, obvious fix (styling/timing/copy)                 | `ExitPlanMode` now → batch-persist → **Inline fix now** (below) → Regression → Step 3                                                                                                                                     |
| No Fail finding, and the remaining Tweak findings don't qualify for the inline row above | `ExitPlanMode` now → batch-persist → **Offload flush** (below) → Regression → Step 3                                                                                                                                      |
| Anything else (any Fail finding present, mixed with or without Tweak findings)           | Stay in plan mode — Read `fix-round.md` and run the round gate; **its** `ExitPlanMode` (presenting interview outcome + fix plan together) closes this walkthrough's plan mode                                             |

**Inline-fix path (skip-gate case)** — mirrors `dev-verify/references/fix-loop.md § Plan-mode gate`'s
skip-silently condition: fix each finding directly in the main chat (the app is already running),
Read `shared/DEBUG-LADDER.md` and apply tier 1 (symptom + cause both visible, ≤1-2 files). If the fix
touches typed code, run the project's typecheck command on the touched file(s) before reloading — a
live "it looks right" confirm from the user cannot catch a type error the dev server silently
tolerates. Then reload, let the user confirm live. **If the fixed finding carries `verdict: "tweak"`,
flip it to `verdict: "pass"` in the same batch-persist** — see the verdict-flip rule in § Offload
flush below; a lingering `"tweak"` verdict on an item that was fixed in-ship (not offloaded) would
let `ship-checkpoint.js route` count it as resolved when nothing actually verified it as such. No
round bookkeeping — this is the common trivial case and should stay friction-free (plan mode itself
already closed by the table above).

**Offload flush** — this is the default outcome for tweak-class findings now: the ship stays
raw-functionality only, improvements ride `/dev-tweak` later. For each tweak finding in this ledger
state, invoke `/project-todo` with one sentence: `"{observed} → {expected}, type TWEAK, depends on
{feature}, parked from /dev-ship manual round"` — batch at most 3 items per invocation
(`project-todo/SKILL.md § PHASE 0` step 3's own multi-item split cap). After each card is created,
upsert the matching ledger item — `node ~/.claude/scripts/ship-checkpoint.js item {feature} manual`
— with `offload: "{card-name}"` (this write happens outside plan mode, right after the
`ExitPlanMode` that closed this routing decision). `shared/TWEAK-DISCIPLINE.md § Card pickup`
documents how `/dev-tweak {card-name}` later picks these up.

**Verdict-flip rule (must-follow).** `ship-checkpoint.js route` counts a `"tweak"` verdict as
resolved — offloading is what makes that true (the item was handed off, not dropped). The
**inline-fix path above is the one exception**: it also carries a `"tweak"` verdict but fixes the
item in-ship rather than offloading it, so that path must flip its verdict to `"pass"` once the live
re-check confirms the fix (stated again there — do not skip it just because it's also stated here).

**Otherwise** → Read `.claude/skills/dev-ship/references/fix-round.md` and follow it: the
hoisted-bookkeeping + round-level plan-mode fix-plan gate (Opus designs the fix, in the **same**
plan-mode session as the interview, grouping findings into file-disjoint waves and deciding
inline-vs-agent dispatch per group), the `ship-fix.js` dispatch (Sonnet), and the post-dispatch
re-check. That file owns everything from here through "all findings resolved or explicitly
deferred" — it returns control here only when ready for the regression re-check below. Its own
`§ Re-check` handles the case where a fail-round's remaining findings turn out to be tweak-only
partway through (a fail got fixed, only tweaks remain) — same offload flush, entered from there
instead of here.

**Policy — a `fail` finding never leaves the ship via a backlog todo.** It is fixed, parked (the
checkpoint stays open, the feature stays non-DONE — see `fix-round.md § Re-check`'s park option), or
escalated via the debug ladder. Tweak findings and net-new capability (walkthrough Step F) default to
`/project-todo` offload (as `type TWEAK` for tweaks) — the ship then finalizes normally and
**refactor runs as usual** (no deferral). `Skip`/`Defer` outcomes never block finalize either — they
are recorded (deferred items stay open for a later re-test), and the flow continues regardless of how
many are open; remember that Defer is for external blockers only (walkthrough Step C) — a `fail` is
never disguised as a Defer to get it out of the way. Unproven passes (an evidence-class Pass with
`evidence: "none"`) never block either — they are surfaced in the routing summary and the completion
report, nothing more (soft gate).

## Regression re-check (before completion)

If **any** PHASE 3 fix or tweak touched code, run the FULL test suite **plus a typecheck/lint pass**
(the project's own commands, e.g. `tsc --noEmit` + the linter) once before Step 3. Skip only when
nothing was changed in this phase (all items passed first time). Plan mode is not active here.

> **Todo**: dispatch the fork below first. Fall back to inline `run_in_background` only when the
> fork dispatch itself errors — running the suite inline by default defeats the reason this section
> exists (keeping the raw test/typecheck/lint output out of the main-chat context).

**Primary — fork dispatch** (`shared/SKILL-PATTERNS.md § Fork Delegation`): dispatch one fork — it
knows from context which fixes were just made. **Scope this prompt explicitly**: the fork's ONLY job
is to run the suite + typecheck/lint and return a digest — it must NOT act on the result, continue
the ship (PHASE 3 completion, PHASE 4 refactor/finalize, merges), or call the Workflow tool, even
though it inherits full conversation context and technically could. State this negative boundary in
the fork's prompt itself, not just here. **State this too**: run each command as a blocking,
foreground Bash call inside the fork — never `run_in_background` — and the fork's final answer must
be the actual digest, not a "still running" status; a fork that reports it kicked off a background
process instead of returning results has failed the task, not completed it. It returns ONLY a
compact digest: overall pass/fail, typecheck/lint pass/fail, and on any fail, each NEW failure
relative to the known state (test name + first error line). End the turn, wake on its notification —
do not resume the fork with follow-up instructions that could restart it mid-pipeline; if the digest
is incomplete or wrong, re-dispatch a fresh fork instead. **Fallback:** run the suite +
typecheck/lint inline via `run_in_background` Bash and read only the failure tail, not the full log.

New failures → back into the fix routing above (ladder escalation applies); clean → proceed to
Step 3.

## Step 2 teardown — stop the launched app

Stop the app you launched in Step 2 in **either** of these two moments — whichever comes first:

- **Full resolution**: all items verdicted, any fix-round re-checks passed, regression re-check
  clean, right before proceeding to Step 3.
- **A fix-round park** (`fix-round.md § Re-check`'s Otherwise bullet, or the "Park — debug in a
  fresh chat" choice): right before ending the turn — a fresh session's `debug-round.md` resume
  relaunches its own app instance, so leaving this one running orphans a duplicate dev-server/port
  across the session boundary.

Kill the process(es) you started in Step 2 in either case. A lingering app process serves no further
purpose here and would otherwise still be running when PHASE 4 spawns the refactor agent into the
same worktree (potential file-lock/port contention, and simply wasted resources). Skip silently when
Step 2 never launched anything (the no-manual path).

**Clean up manual-test fixtures created outside the worktree.** When the app's active-project
selection pointed at the main checkout instead of the worktree (the mismatch this file already warns
about above), any scratch file created to exercise a manual item lands in main, not the worktree — it
is untracked and irrelevant to the merge, but a stray file/directory there will otherwise trip
`shared/FINALIZE.md`'s pre-merge Uncommitted Changes Check with an avoidable prompt. Remove such
fixtures now, in the same teardown moment as the app kill.

## Step 3 — Completion (DONE)

All AUTO passed (AGENT 2) and no open manual FAIL → complete (but do **not** integrate yet):

1. **Known-issue payload**: scan `checkpoint.manual.items[]` for every item with
   `verdict: "accepted"` or `verdict: "deferred"` and map each to
   `{ id, title, verdict, reason, source: "ship-ledger" }` — `reason` is a short synthesis of the
   item's `expected`/`lightRoundNotes`/context (same free-text judgment already used for
   `fixSync`/`observations`). Pass the result as `payload.knownIssues` on the completion-sync call
   below (omit the key entirely when empty — never send `[]`). This is what survives the ship
   checkpoint's eventual deletion (`SKILL.md § PHASE 1–4`, on green completion); without it, an
   explicitly accepted or deferred finding leaves no trace once the ship completes.
2. Run `dev-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section + learning extraction) — Read `.claude/skills/dev-ship/references/dev-verify/references/completion-sync.md`
   if the reused flow does not already cover it from the manual step. (This is the DONE write AGENT
   2 was told to skip.) **Skip completion-sync's tail handoff**: its `VERIFY COMPLETE` block ends
   with a `Next: /dev-refactor` line + a Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit either. dev-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning
   extraction, drop the terminal handoff (adapter rule 4, applied here in the main chat).

Do **not** finalize/merge here — stay in the worktree. Finalize runs at the end of PHASE 4
(SKILL.md § PHASE 1–4) so refactor commits land on the feature branch first. **Return to SKILL.md
§ PHASE 1–4**: continue per `references/orchestration.md § 5` (the checkpoint's `route` subcommand
sends you straight to PHASE 4) and handle its notification there. **Idempotency note**: `route` may
still return `"phase3-completion"` even when this Step 3 already ran inline (e.g. a resume that
landed directly in the manual round) — that's expected, not a signal to redo it; Step 1+3 are safe
to re-run but unnecessary if already done, so just proceed to § 5.

## Guard

Never merge in this phase, even on all-green. The merge belongs to PHASE 4's finalize step. (On a
manual FAIL the routing above already blocks PHASE 4.)
