# PHASE 3 — Manual tests + Finalize/merge (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` reaches the real user. Resumes the half of `dev-verify`
that AGENT 2 deliberately skipped: the manual walkthrough (if any), the DONE completion, and the
finalize/merge. AGENT 2's `remainingManualItems` is authoritative here.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` with `feature-name = {feature}`
and `feature.status = DOING`. This switches to `worktree-{feature}` (needed for the dev-server /
Playwright daemon that the walkthrough uses) and runs the symlink-integrity gate.

## Step 2 — Manual walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the 85% case) — go
straight to Step 3.

**Launch the app + hand off — don't block on a readiness grep.** Start the app framework-appropriately
in the background (web: dev server; native/Tauri: `npm run tauri dev` — the Rust compile is slow, so
tell the user it is building). Then **hand the checklist to the user immediately** and let them confirm
when the window is up: _a manual test is verified by the human, not by a log line — the person at the
window is the readiness signal._ Never make the user wait on your own "is it ready yet" check.

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

## Step 3 — Completion + Finalize/merge

All AUTO passed (AGENT 2) and no open manual FAIL → complete and integrate:

1. Run `dev-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section + learning extraction) — Read `.claude/skills/dev-ship/references/dev-verify/references/completion-sync.md`
   if the reused flow does not already cover it from the manual step. (This is the DONE write AGENT
   2 was told to skip.) **Skip completion-sync's tail handoff**: its `VERIFY COMPLETE` block ends
   with a `Next: /dev-refactor` line + a Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit either. dev-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning
   extraction, drop the terminal handoff (adapter rule 4, applied here in the main chat).
2. Finalize: Read `.claude/skills/dev-ship/references/dev-verify/references/finalize.md` and execute it — `ExitWorktree`
   note, TEAM_MODE + PR-state action table, then merge via `shared/FINALIZE.md` (solo → merge to
   main + worktree cleanup; open PR / team-open → halt with the printed message and leave the
   worktree, do not force a merge). The solo-merge report may print its own `Next:` line — ignore it;
   dev-ship continues to PHASE 4. The **halt** messages (open PR / team) are not handoff noise: they
   are the legitimate stop signal the Guard below acts on.

After finalize, the shell is back on `main` and the worktree is removed (solo path). **Re-read
`.project/` from disk** before PHASE 4.

## Guard

If Step 3's finalize halts (open PR, team mode) instead of merging, do **not** run PHASE 4 refactor
on an unmerged feature — report the halt in PHASE 5 and stop. Refactor runs post-merge only.
