# PHASE 3 — Manual tests + Completion (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` reaches the real user. Resumes the half of `dev-verify`
that AGENT 2 deliberately skipped: the manual walkthrough (if any) and the DONE completion.
Finalize/merge has moved to the end of PHASE 4 (after refactor) so refactor commits land on the
feature branch first. AGENT 2's `remainingManualItems` is authoritative here.

## Resume entry (fresh session)

When PHASE 3 is entered via a direct resume (a fresh chat re-invoking `/dev-ship {feature}` after the
last session handed off here — the deliberate token break after auto-verify leaves manual items, the
common case — or was interrupted), `results.verify` comes from
the checkpoint (`ship-{feature}.json`), not from an in-context AGENT 2 return. Run **Step 1** (enter
the worktree) and **Step 2** (launch the app via the App-launch rule) exactly as on the normal path,
then route on the checkpoint's `manual` block:

- **No `manual` block, or `manual.items` shorter than `results.verify.remainingManualItems`** →
  run the walkthrough (`manual-interview-walkthrough.md`), filtering `remainingManualItems` down to
  the items **not yet present** in `manual.items` (already-verdicted items are not re-asked). The
  walkthrough's Step A re-arms `active-{feature}.json` with `waiting: "manual-tests"`, so the board
  flips the row from **parked** back to **waiting**.
- **Ledger complete (`manual.items` covers every item, `manual.interviewDone: true`) but no
  `manual.fixPlan`** → go straight to `§ Findings ledger + routing` below and re-enter the fix-plan
  gate (the ledger is durable, so the walkthrough never re-runs — only the round's fix-plan draft was
  lost, same as a rejected-and-abandoned plan would be).
- **`manual.fixPlan` present and `activeWorkflow: "phase3fix"`** (a dispatch was in flight) → go to
  `fix-round.md § Dispatch` and relaunch `ship-fix.js` with `resume` built from `manual.dispatch`
  (cross-session) or `resumeFromRunId` (same session, per `shared/SHIP-RESUME.md`).
- **`manual.fixPlan` present and dispatch complete (`manual.dispatch.allFixed` or all groups
  terminal)** → go to `fix-round.md § Re-check`.

Keep the checkpoint `phase: "PHASE 3"` throughout.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` with `feature-name = {feature}`
and `feature.status = DOING`. This switches to `worktree-{feature}` (needed for the dev-server /
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

> If you genuinely must detect readiness programmatically (e.g. to auto-open a browser tab), it MUST
> (a) tolerate ANSI color codes — match the bare word (`grep -aE "Running|Finished|error"`), never a
> literal `Running \`space\`…`pattern, because Cargo/Vite wrap words in ANSI escapes so "Running" is
followed by an escape, not a space; and (b) use a **bounded** wait (a `run_in_background` `until`loop with a timeout / fixed poll count) that falls back to surfacing to the user — never an
unbounded`until` that can hang forever on a signal that never arrives.

Then run the **item-by-item interview walkthrough**: Read
`.claude/skills/dev-ship/references/manual-interview-walkthrough.md` and execute it for the
`remainingManualItems` from AGENT 2 — items are presented one at a time, each judged live, non-pass
verdicts get their detail captured immediately, and a closing interview asks what else should be
different or better. **Nothing is fixed during this walkthrough** — it only builds the findings
ledger (persisted to the checkpoint after every item, so a killed session resumes mid-walkthrough).

## Findings ledger + routing

Once the walkthrough (`manual-interview-walkthrough.md`) returns, route on the accumulated ledger
(`manual.items` + any interview-close findings):

| Ledger state                                                                    | Route                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| No Fail/Tweak findings (all Pass, or only Skip/Defer)                           | Skip to Regression re-check → Step 3                            |
| ≤2 findings, all MEASURABLE, cosmetic, obvious fix (styling/timing/copy)        | **Inline fix now** (below) — no gate — then Regression → Step 3 |
| Anything else (any TESTABLE finding, >2 findings, or an unclear/multi-file fix) | Read `fix-round.md` and run the round loop                      |

**Inline-fix path (skip-gate case)** — mirrors `dev-verify/references/fix-loop.md § Plan-mode gate`'s
skip-silently condition: fix each finding directly in the main chat (the app is already running),
Read `shared/DEBUG-LADDER.md` and apply tier 1 (symptom + cause both visible, ≤1-2 files), reload,
let the user confirm live. No plan mode, no round bookkeeping — this is the common trivial case and
should stay friction-free.

**Otherwise** → Read `.claude/skills/dev-ship/references/fix-round.md` and follow it: the
hoisted-bookkeeping + round-level plan-mode fix-plan gate (Opus designs the fix, groups findings into
file-disjoint waves, decides inline-vs-agent dispatch per group), the `ship-fix.js` dispatch (Sonnet),
and the post-dispatch re-check. That file owns everything from here through "all findings resolved or
explicitly deferred" — it returns control here only when ready for the regression re-check below.

`Skip` / `Defer` outcomes never block finalize — they are recorded (deferred items stay open for a
later re-test), and the flow continues regardless of how many are open.

## Regression re-check (before completion)

If **any** PHASE 3 fix or tweak touched code, run the FULL test suite once before Step 3. New
failures → back into the fix routing above (ladder escalation applies); clean → proceed to Step 3.
Skip only when nothing was changed in this phase (all items passed first time).

## Step 3 — Completion (DONE)

All AUTO passed (AGENT 2) and no open manual FAIL → complete (but do **not** integrate yet):

1. Run `dev-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section + learning extraction) — Read `.claude/skills/dev-ship/references/dev-verify/references/completion-sync.md`
   if the reused flow does not already cover it from the manual step. (This is the DONE write AGENT
   2 was told to skip.) **Skip completion-sync's tail handoff**: its `VERIFY COMPLETE` block ends
   with a `Next: /dev-refactor` line + a Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit either. dev-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning
   extraction, drop the terminal handoff (adapter rule 4, applied here in the main chat).

Do **not** finalize/merge here — stay in the worktree. Finalize runs at the end of PHASE 4
(SKILL.md PHASE 4) so refactor commits land on the feature branch first. Proceed to PHASE 4 with the
worktree active.

## Guard

Never merge in this phase, even on all-green. The merge belongs to PHASE 4's finalize. (On a manual
FAIL the routing above already blocks PHASE 4.)
