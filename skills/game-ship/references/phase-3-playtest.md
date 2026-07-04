# PHASE 3 — Human playtest + Finalize/merge (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` and the interactive game window reach the real user.
Resumes the half of `game-verify` that AGENT 2 deliberately skipped: the live playtest (if any), the
DONE completion, and the finalize/merge. AGENT 2's `remainingManualItems` is authoritative here.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` with `feature-name = {feature}`
and `feature.status = DOING`. This switches to `worktree-{feature}` (needed for the godot-mcp
project launch and the warm `.godot` import cache) and runs the symlink-integrity gate. Then tag the
board card `stage: "testing"` (Edit `.project/backlog.json` → find feature → `stage: "testing"`,
`data.updated` → now).

## Step 2 — Live playtest walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the GUT-covered case) —
go straight to Step 3.

**Launch one live game window + hand off.** The user plays a single window (not a per-item relaunch)
and reports back. Read `.claude/skills/game-ship/references/playtest-batch-walkthrough.md` and
execute it for the `remainingManualItems` from AGENT 2 — it flags the board amber
(`"waiting":"playtest"`), launches `playtest_scene.tscn` via `mcp__godot-mcp__run_project`, presents
the whole TEST SCENARIO + EXPECTED BEHAVIOR checklist once, captures DebugListener output, and judges
in one batched `AskUserQuestion` round. Record outcomes.

**On any playtest FAIL — categorize the feedback, then fix (bounded loop).** For each failed item,
categorize per game-verify's Feedback Categorization (TESTABLE / MEASURABLE / SUBJECTIVE):

- **SUBJECTIVE** → one clarifying `AskUserQuestion` to make it concrete (too fast/slow, too
  strong/weak, wrong timing, visual, audio, other) → re-categorize as TESTABLE or MEASURABLE.
- **TESTABLE** (concrete value: "radius 50, should be 100") → write a reproduction GUT test (RED),
  fix the code, re-run headless (GREEN).
- **MEASURABLE** (relative, no unit test: "animation too slow") → adjust the value directly, then
  re-test live.

Route the fix work via **one `AskUserQuestion`** (first option recommended):

- **Fix via background agent (Recommended)** → write a compact failure descriptor (each failed item:
  title, category, steps, expected, observed) to `.project/session/ship-prompts/{feature}-fix.txt`,
  then spawn **one** `general-purpose` `Task` with this pointer prompt (paths, not bodies — the same
  discipline as the phase agents):

  ```
  You are a fix agent in the game-ship pipeline for feature "{feature}". First switch into
  worktree-{feature} at {worktreePath} (via .claude/skills/shared/WORKTREE.md). Read
  `.claude/skills/game-ship/references/non-interactive-contract.md` and obey it (headless GUT only,
  never launch a game window — contract rule 8). Read the failure descriptor at
  `.project/session/ship-prompts/{feature}-fix.txt`. For each failed item: for TESTABLE write a
  reproduction GUT test then fix; for MEASURABLE adjust the value. Get the FULL GUT suite green
  (headless) before returning. Commit scoped to the worktree; never merge. Return ONLY:
  SHIP_FIX_RESULT_START
  status: fixed | partial | failed
  itemsFixed: [<item title>, ...]
  notes: <1-line, or the blocker if not fixed>
  SHIP_FIX_RESULT_END
  ```

  On return, **re-present only the previously-failed items** against a fresh game launch (batched,
  via the same walkthrough). Max **2-3** fix rounds; if still failing after that, route via a second
  `AskUserQuestion`: background fix agent again / interactive `/game-debug {feature}` / stop. Keep the
  checkpoint `phase: "PHASE 3"` throughout (resumable). Do not finalize until every previously-failed
  item passes.

- **Interactive debug** → stop the hands-off flow and hand to `/game-debug {feature}` (or
  `/game-verify {feature} {feedback}`) in the main chat. The worktree stays intact.
- **Stop and report** → do not finalize, do not proceed to PHASE 4; report the failed item in
  PHASE 5 and leave the worktree intact.

`Skip` / `Defer` outcomes do not block finalize — they are recorded (deferred items stay open for a
later re-test), and the flow continues.

**Regression re-check after fixes** — if any PHASE 3 fix was applied, re-run the FULL GUT suite
headless (`"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit`) once before
Step 3. New failures → back into the fix loop (max rounds as above); clean → continue.

## Step 3 — Completion + Finalize/merge

All COVERED passed (AGENT 2) and no open playtest FAIL → complete and integrate:

1. Run `game-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section: `finalStatus`, `sessions[]`, `requirements[].status`, `stage → "done"` + learning
   extraction) — Read
   `.claude/skills/game-ship/references/game-verify/references/completion-finalize.md` and run its
   Steps 0-2 (Fix Sync only if fixes were applied; Out-of-scope Observations; the parallel sync). This
   is the DONE write AGENT 2 was told to skip. **Skip completion-finalize's tail handoff**: its
   output ends with a `Next steps` / Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit it. game-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning extraction,
   drop the terminal handoff (adapter rule 4, applied here in the main chat).
2. Finalize: run completion-finalize's **PHASE Finalize** block — detect `TEAM_MODE` + PR state, then
   merge via `shared/FINALIZE.md` (solo → merge to main + worktree cleanup; open PR / team-no-PR →
   halt with the printed message and leave the worktree, do not force a merge). Any solo-merge report
   `Next:` line — ignore it; game-ship continues to PHASE 4. The **halt** messages (open PR / team)
   are not handoff noise: they are the legitimate stop signal the Guard below acts on.

After finalize, the shell is back on `main` and the worktree is removed (solo path). **Re-read
`.project/` from disk** before PHASE 4.

## Guard

If Step 3's finalize halts (open PR, team mode) instead of merging, do **not** run PHASE 4 refactor
on an unmerged feature — report the halt in PHASE 5 and stop. Refactor runs post-merge only.

## Fallback — godot-mcp unavailable

If `mcp__godot-mcp__run_project` is not available (MCP server not connected), do not block the
pipeline: print the scene path and ask the user to launch it themselves —
`"godot-mcp is unavailable. Open the scene yourself in Godot: .project/features/{feature}/playtest_scene.tscn, then report results."` — and proceed with the same batched
walkthrough (the readiness signal is the human at the window, not an MCP call). DebugListener output
can then be read from `.project/features/{feature}/` logs instead of `get_debug_output`.
