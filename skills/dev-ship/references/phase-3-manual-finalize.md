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

Otherwise run the reused walkthrough: Read `.claude/skills/dev-ship/references/dev-verify/references/manual-walkthrough.md`
and execute it for the `remainingManualItems` from AGENT 2 (Playwright smoke pre-check where the
item is DOM-observable, then the per-item `Pass / Fail / Skip / Defer` prompt). Record outcomes.

**On any manual FAIL:** stop here. Do **not** finalize, do **not** proceed to PHASE 4. Report the
failed item and hand to `/dev-debug {feature}` or `/dev-verify {feature} {feedback}`. The worktree
stays intact.

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
