# Orchestration — PHASE 1–4 (executed by the main chat)

This is the autonomous stretch of the ship pipeline — build, auto-verify, the no-manual completion,
refactor, security, and finalize. **You, the main chat, execute this directly** by launching
background Workflows and ending your turn between launches; a task-notification wakes you when each
workflow returns. There is no separate orchestrator agent — a background subagent cannot call the
Workflow tool (confirmed: it is not reachable even via `ToolSearch`), so routing this through a
spawned agent bought nothing but an extra hop and the inferior Agent-tool fallback. Running it
inline costs nothing extra: Workflow already runs in the background and notifies you on return.

## 1. Ground rules

- All checkpoint and live-signal writes go through `node ~/.claude/scripts/ship-checkpoint.js`
  (`patch`/`init`/`signal`/`signal-clear`/`route` with JSON on stdin where applicable) — it resolves
  the main checkout root itself, so it is safe to call from any cwd (including from inside the
  feature worktree during PHASE 3/4).
- You are the checkpoint's only writer throughout (worker subagents never touch it —
  non-interactive-contract rule 1).
- If the `Workflow` tool's schema is not yet loaded, call `ToolSearch query="select:Workflow"`
  first.
- **`Workflow`'s `scriptPath` is NOT cwd-safe** (unlike `ship-checkpoint.js` above) — a relative
  path resolves against the main chat's current directory. By §5 the main chat is always inside
  `worktree-{feature}` (PHASE 3 Step 1 already switched in), where `.claude/` does not exist — a
  relative `scriptPath` there fails outright. Always resolve `main_root` first (`git worktree
list --porcelain | head -1`, same as the triage-persist step in §5) and pass an absolute path.
- Each `Workflow(...)` launch below ends your turn with a short one-liner ("Shipping `{feature}` in
  the background — I'll report when it returns.") — no further tool calls until the task-notification
  arrives.

## 1a. Recovering an interrupted Workflow

A task-notification can arrive as `status: "stopped"` or with a "could not be resumed"
message instead of a normal result — this means the harness process itself restarted
mid-run, not that the launched work failed. Do not restart the ship from PHASE 0 and do
not blindly relaunch with `resumeFromRunId` on faith; verify first.

1. Read the checkpoint (`ship-{feature}.json`) — `workflowRunId` names the interrupted
   run, `prompts` names the pointer files it was given.
2. Verify on-disk state before trusting a resume: does `worktree-{feature}` exist
   (`git worktree list`)? Does its branch have commits past `baselineSha`
   (`git log worktree-{feature} --oneline`)? Do the changed files match what the
   pointer-file prompt asked for?
3. Evidence of completed work → relaunch the SAME Workflow with
   `resumeFromRunId: {workflowRunId}` from the checkpoint (never a fresh launch — a
   dead-agent result would just replay `null` from cache, per the empty-input safety net
   below). Completed `agent()` calls return from cache instantly; only the interrupted
   step re-runs.
4. No evidence of any progress (no worktree, no commits) → treat as a fresh launch of
   the same phase — `phase`/`completedPhases` on the checkpoint are unaffected either way.

## 2. Route on the checkpoint

Run `node ~/.claude/scripts/ship-checkpoint.js route {feature}` — it reads
`.project/session/ship-{feature}.json` and returns `{"route": "...", "resume": {...}|null}`
(the logic is documented at the top of the script; it mirrors §3–§5 below exactly, so treat its
output as authoritative rather than re-deriving it by hand):

- `"phase12"` → go to **§3 Phase 1+2**, passing the returned `resume`.
- `"phase3-completion"` → go to **§4 PHASE 3 completion (no-manual path)**.
- `"phase3-manual"` → this is the interactive round — go to
  `phase-3-manual-finalize.md` (main-chat manual round), not this file.
- `"phase4"` / `"phase4-finalize-only"` → go to **§5 Phase 4 + finalize**, passing the returned
  `resume` (on `"phase4-finalize-only"` skip straight to the finalize step inside §5 — the refactor
  already ran).

## 3. Phase 1+2: Build (AGENT 1) → Auto-verify (AGENT 2) — Workflow 1

Write the live signal: `echo '{"skill":"build"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`.

Launch (resolve `main_root` and use an absolute `scriptPath`, per § Ground rules):
`Workflow({scriptPath: "{main_root}/.claude/skills/dev-ship/references/workflows/ship-phase12.js", args:
{feature, buildPromptPath, verifyPromptPath, resume}})` — `buildPromptPath`/`verifyPromptPath` come
from the pointer files you wrote at the PHASE 0→1 boundary (SKILL.md § PHASE 1–4), or from the
checkpoint's `prompts` field on a respawn (reassemble from `plan` + disk per
`agent-build.md`/`agent-verify.md` § Spawn only if a pointer file is missing). `resume` is the value
`route` returned — `null` on a fresh run, or the green results on a respawn.

**Immediately after launch**, write point 2: patch `{"activeWorkflow":"phase12","workflowRunId":
"{runId}","prompts":{"buildPromptPath":...,"verifyPromptPath":...}}` — this is what makes a
mid-workflow crash resumable. **End the turn here** — no further tool calls.

The workflow runs AGENT 1 (build) then AGENT 2 (verify, fresh adversarial context) sequentially and
returns one structured object; it skips verify when build fails. The task-notification with this
result wakes you back up.

On return, write point 3: patch to clear `activeWorkflow`/`workflowRunId`/`prompts` and merge the
returned `build`/`verify` objects into `results`. Then branch:

**Empty-input safety net** (rare, check first): the script normalizes `args`, so string-delivery
failure is handled at the source. If an agent still reports no/`undefined` input (`testsTotal: 0`,
no worktree created), retry the same `Workflow(...)` launch once (fresh — not `resumeFromRunId`,
since a dead-agent result would just replay `null` from cache) before routing anywhere. Only a genuine
code/test failure follows the branches below.

- `status: "green"` → mark `completedPhases += ["PHASE 1","PHASE 2"]`, `phase: "PHASE 3"`.
  Re-read `.project/` from disk. **Offload flush**: non-empty `verify.improvementNotes` → for each
  note, first check `backlog.json#features[]` for an existing TODO card whose `description` already
  covers it (a concurrent sibling `/dev-ship` run shares this project's `.project/`, not a
  per-worktree copy, and may have already logged the same observation) — skip the `/project-todo`
  call for that note if a match exists. Otherwise judge the note's projected scope against
  `shared/TWEAK-DISCIPLINE.md § Size gate` criteria 1-4 (same judgment and same default-to-TWEAK-on-
  a-close-call rule as `phase-3-manual-finalize.md § Offload flush` — an auto-verify improvement note
  is typically small, but not always) and invoke `/project-todo` **once per uncovered note**: within
  the gate, `"{note}, type TWEAK, depends on {feature}, parked from /dev-ship auto-verify"`;
  exceeding it, drop the `type` hint and name the reason instead — `"{note}, depends on {feature},
parked from /dev-ship auto-verify (exceeds tweak size gate: {criterion})"` (plain inference then
  lands on `CHANGE`/`FEATURE`). These are independent single-sentence cards, not a cross-domain
  cluster, so do not concatenate multiple notes into one call (`/project-todo`'s own multi-item split
  is content-signal-based, not a manual-batch interface). A note that is self-documenting in the
  code and names no follow-up action (AGENT 2 says so explicitly) needs neither a card nor a
  covered-by match — count it as `nonActionable` instead of forcing it into either bucket.
  **Completion check**: after the loop,
  print one line — `Offload: {cardsCreated}/{M} notes → cards, {alreadyCovered} already covered,
  {nonActionable} non-actionable` (`M` = `verify.improvementNotes.length`) — confirming
  `cardsCreated + alreadyCovered + nonActionable` equals `M` before proceeding; a printed
  mismatch is the signal that an invocation was skipped instead of run.
  These are AGENT 2's own observations, never a ledger item, so there's no `offload` field to
  upsert or verdict to set regardless of which card type they landed on. Do this before
  either branch below, since it applies regardless of which one fires. Branch on
  `verify.remainingManualItems`:
  - **Empty** → go to **§4 PHASE 3 completion (no-manual path)**.
  - **Non-empty** → `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}` (board renders
    **parked** with the resume button); print this handoff message (English source, translate per
    LANGUAGE.md), then **end the turn**:
    ```
    PHASE 1+2 green — {testsTotal} tests pass, {N} manual items remain.
    To keep this chat cheap, the run stops here — checkpoint ready.

    → Run /clear (or open a new chat), then: /dev-manual {feature}
      Lands directly in the item-by-item manual round (worktree + app
      relaunch automatically). /dev-ship {feature} also still resumes here.

    The board shows this run as parked (⏸) with the same resume button.
    Prefer to continue here? Say so and I'll run PHASE 3 in this session.
    ```
    **Same-session escape hatch**: if the user replies "continue here" (or equivalent), continue inline
    in this chat instead of parking: re-arm the live signal and run the full manual walkthrough per
    `SKILL.md § PHASE 3` (`phase-3-manual-finalize.md`, Step 1 + Step 2 + Step 3) — **not** the no-manual
    shortcut in **§ 4** below, which only applies when `remainingManualItems` was empty.
- `failedPhase: "build"` → patch `{"status":"failed"}` (keep everything else),
  `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`, print the failure recovery
  message (SKILL.md § PHASE 1–4), proceed to PHASE 5's failure path.
- `failedPhase: "verify"` → same as build-failure, `failedPhase:"verify"`. Do not finalize.

## 4. PHASE 3 completion (no-manual path)

Re-read `.project/` from disk. Read `.claude/skills/dev-ship/references/phase-3-manual-finalize.md`
and execute only:

- **Step 1** (enter the worktree, via `shared/WORKTREE.md`), then
- **Step 3** (Completion — the completion-sync DONE write).

**Skip Step 2 entirely** (no app launch, no manual walkthrough — this route only fires when
`remainingManualItems` was empty or the ledger is already fully resolved). Do not read
`manual-interview-walkthrough.md` or `fix-round.md`.

Then go to **§5 Phase 4 + finalize**.

## 5. Phase 4: Refactor (AGENT 3) [+ optional security AGENT S] + Finalize/merge — Workflow 2

Patch `{"phase":"PHASE 4","completedPhases":[...,"PHASE 3"]}` (the feature is DONE and verified,
still on the feature branch in the worktree — not yet merged). Refactor always runs (auto-derived
lenses); skip straight to the finalize step below **only** if the `--no-refactor` escape hatch was
set **and** `securityDeep` is empty.

**Before spawning**: (a) capture the revert anchor `preRefactorSha = git -C {worktreePath}
rev-parse HEAD` and patch it to the checkpoint; (b) run the TEAM_MODE + PR-state detection from
`references/dev-verify/references/finalize.md` and decide `finalizeRoute: merge | halt` (`merge`
on the solo/`MERGED` rows, `halt` on the open-PR / team rows) — this decides whether AGENT 3 does
the shipped completion writes; (c) safety net — check for a still-running app/dev-server process
whose cwd is `{worktreePath}` (a PHASE 3 manual-round app that `phase-3-manual-finalize.md`'s
teardown step missed, e.g. on a crash-resume) and kill it before spawning — the refactor agent
runs its own tests in this same worktree and a lingering process is unrelated interference to rule
out up front, not discover mid-merge; (d) when `finalizeRoute: merge` — run `git -C {main_root}
status --porcelain` now (the same check `finalize.md § Solo-Merge Procedure` step 3b runs later)
and, if non-empty, ask the same Stop/Stash/Ignore `AskUserQuestion` immediately, before spawning
the refactor agent — a dirty target blocks the eventual merge regardless of how refactor goes, so
surface it before spending a refactor pass on a ship that may not be mergeable yet. On "Stash" or
"Ignore", proceed to spawn as normal; the later step 3b re-check in `finalize.md` still applies as
a safety net (main's state may have changed in the meantime).

Otherwise: rewrite the live signal (same as §3): `echo '{"skill":"refactor"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`. Read
`.claude/skills/dev-ship/references/agent-refactor.md` (when refactor runs) and
`.claude/skills/dev-ship/references/agent-security.md` (when `securityDeep` is non-empty) — their
**§ Spawn → Pointer file** templates only. Rebuild the **refactor-slice** fresh from the post-verify
`.project/` (shared into the worktree via symlinks — built files + fresh learnings; use
`shared/PROJECT-CONTEXT-LOAD.md` + `shared/LEARNINGS-LOAD.md` the same way a checkpoint resume
does), **write each pointer + slice file** (carrying the worktree path + `finalizeRoute`) under
`.project/session/ship-prompts/`, and pass the **paths** (never inline).

Launch — **use an absolute `scriptPath`** (main chat is inside `worktree-{feature}` here;
`.claude/` is not checked out in a worktree, so a relative path fails — resolve `main_root` the
same way the triage-persist step below does): `Workflow({scriptPath:
"{main_root}/.claude/skills/dev-ship/references/workflows/ship-phase4.js", args:
{feature, refactorPromptPath, scanners, triagePromptPath, resume}})` — `refactorPromptPath: null`
only when `--no-refactor` was set; `scanners: []` when `securityDeep` is empty (otherwise one
`{code, promptPath}` per auto-derived OWASP code, per `agent-security.md`); `triagePromptPath` a
pointer file per its § Triage section; `resume` = the value `route` returned — `null` fresh or the
completed `{refactor, triage}` results on a respawn (a failed refactor re-runs). The same
empty-input safety net from §3 applies here.

**Immediately after launch**, write point 2: patch `{"activeWorkflow":"phase4","workflowRunId":
"{runId}","prompts":{...}}`. **End the turn here.**

On return, write point 3: clear `activeWorkflow`/`workflowRunId`/`prompts`, merge
`refactor`/`triage` into `results`. If `refactor.status: "failed"` → revert the branch (`git -C
{worktreePath} reset --hard {preRefactorSha}`, non-fatal, note `reverted:true` for the report) —
still finalize.

**Persist the triage** (only if `results.triage` is non-null — `scanners` was empty, or ran with 0
findings above threshold, otherwise): the
ship checkpoint is deleted on `status: "complete"` (SKILL.md § PHASE 5's checkpoint cleanup), so
without this the triage vanishes the moment the feature finishes shipping and PHASE 5's "run
`/dev-security {feature}`" offer would point at nothing. Write a durable copy that survives it:

- Resolve `main_root` the same way `ship-checkpoint.js` does (`git worktree list --porcelain | head
-1`, strip the `worktree ` prefix) — cwd may still be inside `{worktreePath}` here and
  `.project/security/` is **not** symlinked (`shared/WORKTREE.md § What to share`), so a relative
  path would silently write into the worktree and be lost at cleanup.
- `mkdir -p "$main_root/.project/security"`, then atomic-write (never a direct `cat >`/
  `echo >` overwrite, which risks a truncated file on a killed session):
  ```bash
  TMP="$main_root/.project/security/.ship-triage-{feature}.json.tmp"
  printf '%s' "$JSON_PAYLOAD" > "$TMP" && mv "$TMP" "$main_root/.project/security/ship-triage-{feature}.json"
  ```
  (same tmp+rename pattern as `ship-checkpoint.js`'s `atomicWrite`) with this shape:
  ```json
  {
    "schemaVersion": 1,
    "feature": "{feature}",
    "writtenAt": "{ISO 8601, now}",
    "scannersRun": "{ship-phase4.js result.scannersRun}",
    "scannersFailed": "{ship-phase4.js result.scannersFailed}",
    "findingsAboveThreshold": "{ship-phase4.js result.findingsAboveThreshold}",
    "triage": "{ship-phase4.js result.triage — {confirmed[], dismissed[], summary}}",
    "backlogTodo": null
  }
  ```
- On the Agent-tool fallback path (`agent-security.md § Main-chat handling`, fallback bullet), write
  the same file from the inline triage result assembled there.

This write happens **before** PHASE 5's checkpoint cleanup and is a plain state file, not part of
the checkpoint — never stage it into git; it lives under `.project/`, which is gitignored
per-developer runtime state, same as the rest of `.project/session/`.

**Then finalize** — Read
`.claude/skills/dev-ship/references/dev-verify/references/finalize.md` and execute it (solo →
merge + worktree cleanup; open PR / team → halt and leave the worktree). It also owns the
**merge-route postconditions**: post-merge archive reconcile + self-heal, `shippedSha` re-stamp,
and state auto-push (its § Post-merge reconcile).

**On a real merge conflict** during the solo-merge step (two features touched the same file) — do
**not** improvise from scratch: Read `references/merge-conflict-resolution.md` first. It documents
the extract-both-sides + reconstruct technique and the diff3 shared-closing-brace-tail trap that
silently breaks a naive concatenation.

**Do not skip the archive-reconcile check even if the project's actual `backlog.json` looks
inconsistent with it.** Re-read `backlog.json#features[]` after the merge: if the just-shipped
feature is still present there, that is a half-run — move it to `.project/archive/backlog-archive.json`
per `finalize.md`'s self-heal, do not leave it and match precedent. If you find this check does not
match the project's established pattern for prior ships, say so explicitly to the user instead of
silently choosing one behavior over the other.

**Guard** — never finalize before the refactor workflow returns; never skip finalize because
refactor failed. Finalize runs on both the `applied|clean` and the reverted-`failed` path.

Only after finalize (or halt): patch `{"phase":"PHASE 5","completedPhases":[...,"PHASE 4"]}`,
re-read `.project/` from disk, then proceed to SKILL.md's PHASE 5 (report, learnings, consolidation
gate).

## 6. Fallback (Workflow tool unavailable)

Spawn AGENT 1/2 (or AGENT 3 + scanners) sequentially via the Agent tool, by yourself (no
intermediate agent), per the Spawn sections in `agent-build.md`/`agent-verify.md` (or
`agent-refactor.md`/`agent-security.md`), models per SKILL.md § Design (effort not settable),
rebuilding slices + worktree paths between spawns, and parsing the `SHIP_*_RESULT` blocks. On a
respawn, skip any spawn whose result is already in the checkpoint's `results` (`resumeFromRunId`
does not apply to the Agent-tool path). Run the security triage judgment inline yourself over the
threshold-filtered findings.
