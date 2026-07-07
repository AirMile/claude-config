# Orchestration — PHASE 1–4 (executed by the main chat)

This is the autonomous stretch of the ship pipeline — build, GUT auto-verify, the no-playtest
completion, refactor, and finalize. **You, the main chat, execute this directly** by launching
background Workflows and ending your turn between launches; a task-notification wakes you when each
workflow returns. There is no separate orchestrator agent — a background subagent cannot call the
Workflow tool (confirmed: it is not reachable even via `ToolSearch`), so routing this through a
spawned agent bought nothing but an extra hop and the inferior Agent-tool fallback. Running it
inline costs nothing extra: Workflow already runs in the background and notifies you on return.

## 1. Ground rules

- All checkpoint and live-signal writes go through `node ~/.claude/scripts/ship-checkpoint.js`
  (`patch`/`init`/`signal`/`signal-clear`/`route` with JSON on stdin where applicable, `pipeline:
"game"`) — it resolves the main checkout root itself, so it is safe to call from any cwd (including
  from inside the feature worktree during PHASE 3/4).
- You are the checkpoint's only writer throughout (worker subagents never touch it —
  non-interactive-contract rule 1).
- **You have no display.** Never call `mcp__godot-mcp__run_project` or any MCP call that opens an
  interactive game window in this file's scope — build and GUT auto-verify run **headless only**. The
  only interactive launch is the main chat's own PHASE 3 playtest, handled separately.
- If the `Workflow` tool's schema is not yet loaded, call `ToolSearch query="select:Workflow"`
  first.
- Each `Workflow(...)` launch below ends your turn with a short one-liner ("Shipping `{feature}` in
  the background — I'll report when it returns.") — no further tool calls until the task-notification
  arrives.

## 2. Route on the checkpoint

Run `node ~/.claude/scripts/ship-checkpoint.js route {feature}` — it reads
`.project/session/ship-{feature}.json` and returns `{"route": "...", "resume": {...}|null}`
(the logic is documented at the top of the script; it mirrors §3–§5 below exactly, so treat its
output as authoritative rather than re-deriving it by hand):

- `"phase12"` → go to **§3 Phase 1+2**, passing the returned `resume`.
- `"phase3-completion"` → go to **§4 PHASE 3 completion (no-playtest path)**.
- `"phase3-manual"` → this is the interactive playtest round — go to `phase-3-playtest.md` (main-chat
  playtest round), not this file.
- `"phase4"` / `"phase4-finalize-only"` → go to **§5 Phase 4 + finalize**, passing the returned
  `resume` (on `"phase4-finalize-only"` skip straight to the finalize step inside §5 — the refactor
  already ran).

## 3. Phase 1+2: Build (AGENT 1) → GUT auto-verify (AGENT 2) — Workflow 1

Write the live signal: `echo '{"skill":"build"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`.

Launch:
`Workflow({scriptPath: ".claude/skills/game-ship/references/workflows/ship-game-phase12.js", args:
{feature, buildPromptPath, verifyPromptPath, resume}})` — `buildPromptPath`/`verifyPromptPath` come
from the pointer files you wrote at the PHASE 0→1 boundary (SKILL.md § PHASE 1–4), or from the
checkpoint's `prompts` field on a respawn (reassemble from `plan` + disk per
`agent-build.md`/`agent-verify.md` § Spawn only if a pointer file is missing). `resume` is the value
`route` returned — `null` on a fresh run, or the green results on a respawn.

**Immediately after launch**, write point 2: patch `{"activeWorkflow":"phase12","workflowRunId":
"{runId}","prompts":{"buildPromptPath":...,"verifyPromptPath":...}}` — this is what makes a
mid-workflow crash resumable. **End the turn here** — no further tool calls.

The workflow runs AGENT 1 (build) then AGENT 2 (GUT verify, fresh adversarial context) sequentially
and returns one structured object; it skips verify when build fails. The task-notification with this
result wakes you back up.

On return, write point 3: patch to clear `activeWorkflow`/`workflowRunId`/`prompts` and merge the
returned `build`/`verify` objects into `results`. Then branch:

**Empty-input safety net** (rare, check first): the script normalizes `args`, so string-delivery
failure is handled at the source. If an agent still reports no/`undefined` input (`testsTotal: 0`,
no worktree created), retry once via §7 (fallback path) before routing anywhere. Only a genuine
code/test failure follows the branches below.

- `status: "green"` → mark `completedPhases += ["PHASE 1","PHASE 2"]`, `phase: "PHASE 3"`.
  Re-read `.project/` from disk. Branch on `verify.remainingManualItems`:
  - **Empty** (the GUT-covered case) → go to **§4 PHASE 3 completion (no-playtest path)**.
  - **Non-empty** → `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}` (board renders
    **parked** with the resume button); print the park/handoff message (SKILL.md § PHASE 1–4,
    "On workflow notification") — a fresh chat runs the live playtest. **End the turn.**
- `failedPhase: "build"` → patch `{"status":"failed"}` (keep everything else),
  `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`, print the failure recovery
  message (SKILL.md § PHASE 1–4), proceed to PHASE 5's failure path.
- `failedPhase: "verify"` → same as build-failure, `failedPhase:"verify"`. Do not finalize.

## 4. PHASE 3 completion (no-playtest path)

Re-read `.project/` from disk. Read `.claude/skills/game-ship/references/phase-3-playtest.md` and
execute only:

- **Step 1** (enter the worktree, via `shared/WORKTREE.md`, tag `stage: "testing"`), then
- **Step 3** (Completion — run `game-verify`'s completion-sync per
  `game-verify/references/completion-finalize.md` Steps 0-2: Fix Sync only if fixes were applied,
  Out-of-scope Observations, the parallel sync — the DONE write).

**Skip Step 2 entirely** (no game window launch, no live playtest — this route only fires when
`remainingManualItems` was empty or the ledger is already fully resolved). Do not read
`playtest-interview-walkthrough.md` or `fix-round.md`.

Then go to **§5 Phase 4 + finalize**.

## 5. Phase 4: Refactor (AGENT 3) + Finalize/merge — Workflow 2

Patch `{"phase":"PHASE 4","completedPhases":[...,"PHASE 3"]}` (the feature is DONE and verified,
still on the feature branch in the worktree — not yet merged). Refactor always runs (auto-derived
lenses); skip straight to the finalize step below **only** if the `--no-refactor` escape hatch was
set.

**Before spawning**: (a) capture the revert anchor `preRefactorSha = git -C {worktreePath}
rev-parse HEAD` and patch it to the checkpoint; (b) run the TEAM_MODE + PR-state detection from
`game-verify/references/completion-finalize.md`'s **PHASE Finalize** block and decide
`finalizeRoute: merge | halt` (`merge` on the solo/`MERGED` rows, `halt` on the open-PR / team
rows) — this decides whether AGENT 3 does the shipped completion writes.

Otherwise: rewrite the live signal (same as §3): `echo '{"skill":"refactor"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`. Read
`.claude/skills/game-ship/references/agent-refactor.md` — its **§ Spawn → Pointer file** template
only. Rebuild the **refactor-slice** fresh from the post-verify `.project/` (shared into the
worktree via symlinks — built files + fresh learnings, including the resolved
`{godot_executable}`; use `shared/GAME-CONTEXT-LOAD.md` + `shared/LEARNINGS-LOAD.md` the same way a
checkpoint resume does), **write the pointer + slice file** (carrying the worktree path +
`finalizeRoute`) under `.project/session/ship-prompts/`, and pass the **path** (never inline).

Launch: `Workflow({scriptPath: ".claude/skills/game-ship/references/workflows/ship-game-phase4.js",
args: {feature, refactorPromptPath, resume}})` — `refactorPromptPath: null` only when
`--no-refactor` was set; `resume` = the value `route` returned — `null` fresh or the completed
`{refactor}` result on a respawn (a failed refactor re-runs). The same empty-input safety net from
§3 applies here. There is no security phase in game-ship — no scanners, no triage.

**Immediately after launch**, write point 2: patch `{"activeWorkflow":"phase4","workflowRunId":
"{runId}","prompts":{...}}`. **End the turn here.**

On return, write point 3: clear `activeWorkflow`/`workflowRunId`/`prompts`, merge `refactor` into
`results`. If `refactor.status: "failed"` → revert the branch (`git -C {worktreePath} reset --hard
{preRefactorSha}`, non-fatal, note `reverted:true` for the report) — still finalize.

**Then finalize** — run `game-verify/references/completion-finalize.md`'s **PHASE Finalize** block
(solo → merge + worktree cleanup; open PR / team → halt and leave the worktree). It also owns the
**merge-route postconditions**: post-merge archive reconcile + self-heal, `shippedSha` re-stamp,
and state auto-push (its § Post-merge reconcile).

**Guard** — never finalize before the refactor workflow returns; never skip finalize because
refactor failed. Finalize runs on both the `applied|clean` and the reverted-`failed` path.

Only after finalize (or halt): patch `{"phase":"PHASE 5","completedPhases":[...,"PHASE 4"]}`,
re-read `.project/` from disk, then proceed to SKILL.md's PHASE 5 (report, learnings, consolidation
gate).

## 6. Fallback (Workflow tool unavailable)

Spawn AGENT 1/2 (or AGENT 3) sequentially via the Agent tool, by yourself (no intermediate agent),
per the Spawn sections in `agent-build.md`/`agent-verify.md` (or `agent-refactor.md`), models per
SKILL.md § Design (effort not settable), rebuilding slices + worktree paths between spawns, and
parsing the `SHIP_*_RESULT` blocks. On a respawn, skip any spawn whose result is already in the
checkpoint's `results` (`resumeFromRunId` does not apply to the Agent-tool path).
