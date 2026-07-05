# PHASE 3 — Manual tests + Completion (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` reaches the real user. Resumes the half of `dev-verify`
that AGENT 2 deliberately skipped: the manual walkthrough (if any) and the DONE completion.
Finalize/merge has moved to the end of PHASE 4 (after refactor) so refactor commits land on the
feature branch first. AGENT 2's `remainingManualItems` is authoritative here.

## Resume entry (fresh session)

When PHASE 3 is entered via a direct resume (a fresh chat re-invoking `/dev-ship {feature}` after the
last session handed off here — the deliberate token break after auto-verify leaves manual items, the
common case — or was interrupted), `results.verify` comes from
the checkpoint (`ship-{feature}.json`), not from an in-context AGENT 2 return. Nothing else changes:
run **Step 1** (enter the worktree) and **Step 2** (launch the app via the App-launch rule) exactly as
on the normal path, then run the batched walkthrough over `results.verify.remainingManualItems`. The
walkthrough's Step A re-arms `active-{feature}.json` with `waiting: "manual-tests"`, so the board
flips the row from **parked** back to **waiting**. Keep the checkpoint `phase: "PHASE 3"` throughout.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` with `feature-name = {feature}`
and `feature.status = DOING`. This switches to `worktree-{feature}` (needed for the dev-server /
Playwright daemon that the walkthrough uses) and runs the symlink-integrity gate.

## Step 2 — Manual walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the 85% case) — go
straight to Step 3.

**Launch the app + hand off — don't block on a readiness grep.** Start the app in the background,
then **hand the checklist to the user immediately** and let them confirm when the window is up:
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
followed by an escape, not a space; and (b) use a **bounded** wait (a`run_in_background` `until`loop with a timeout / fixed poll count) that falls back to surfacing to the user — never an unbounded`until` that can hang forever on a signal that never arrives.

Then run the **batched** walkthrough: Read
`.claude/skills/dev-ship/references/manual-batch-walkthrough.md` and execute it for the
`remainingManualItems` from AGENT 2 — the whole checklist is presented once, judged in one batched
`AskUserQuestion` round, and screenshots are taken only on demand (this replaces the per-item
loop). Record outcomes.

**On any manual FAIL — route the fix (one `AskUserQuestion`, first option recommended):**

- **Fix via background agent (Recommended)** → write a compact failure descriptor (each failed
  item: title, steps, expected, and the observed result from the follow-up round) to
  `.project/session/ship-prompts/{feature}-fix.txt`, then spawn **one** `general-purpose` `Task`
  with this pointer prompt (paths, not bodies — the same discipline as the phase agents):

  ```
  You are a fix agent in the dev-ship pipeline for feature "{feature}". First switch into
  worktree-{feature} at {worktreePath} (via .claude/skills/shared/WORKTREE.md). Read
  `.claude/skills/dev-ship/references/non-interactive-contract.md` and obey it. Read the failure
  descriptor at `.project/session/ship-prompts/{feature}-fix.txt`. For each failed item: write a
  reproduction test where feasible, fix the cause, and get the FULL suite green before returning.
  Commit scoped to the worktree; never merge. Return ONLY:
  SHIP_FIX_RESULT_START
  status: fixed | partial | failed
  itemsFixed: [<item title>, ...]
  notes: <1-line, or the blocker if not fixed>
  SHIP_FIX_RESULT_END
  ```

  On return, **re-present only the previously-failed items** (batched, via the same walkthrough).
  Max **2** fix rounds; if still failing after two, hard-halt: report + hand to `/dev-debug {feature}`.
  Keep the checkpoint `phase: "PHASE 3"` throughout (resumable). Do not finalize until every
  previously-failed item passes.

- **Interactive debug** → stop the hands-off flow and hand to `/dev-debug {feature}` (or
  `/dev-verify {feature} {feedback}`) in the main chat. The worktree stays intact.
- **Stop and report** → do not finalize, do not proceed to PHASE 4; report the failed item in
  PHASE 5 and leave the worktree intact.

`Skip` / `Defer` outcomes do not block finalize — they are recorded (deferred items stay open for a
later re-test), and the flow continues.

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
