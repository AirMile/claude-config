---
name: dev-ship
description: Run define→build→verify→refactor in one auto-mode flow. /dev-ship.
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
writes:
  [
    feature.requirements,
    feature.architecture,
    feature.files,
    feature.build,
    feature.tests,
    feature.seedDrift,
    feature.verificationProfile,
    feature.status,
    backlog.status,
    backlog.features,
    concept.seed,
    project-context.learnings,
    conventions,
  ]
writes-terminal: [feature.refactor, backlog.overview]
metadata:
  author: claude-config
  version: 0.8.1
  category: dev
---

# Ship (auto-mode pipeline)

Runs the full dev pipeline — **define → build → verify → refactor** — in one chat. Heavy work
runs in isolated inline agents (context stays clean); only human interaction (define choices,
manual tests) happens in the main chat. `dev-ship` is the **standalone** dev pipeline: it carries
its own vendored copies of the four phase workflows under `references/dev-{define,build,verify,refactor}/`
and drives them internally — there are no separate `/dev-define`…`/dev-refactor` skills anymore.

**Trigger**: `/dev-ship` or `/dev-ship {feature-name}`

## Design

- **One human touchpoint** (PHASE 0 define + plan-approval gate); then hands-off except the
  conditional PHASE 3 manual round. Merge happens at the end of PHASE 4. `verificationProfile` is
  advisory; AGENT 2's `remainingManualItems` is authoritative for PHASE 3.
- **Build and verify are separate agents/contexts** (fresh verify = adversarial). **`.project/` is
  shared on disk, context isolated** — sequential, one writer, re-read `.project/` after every agent
  return. See `references/agent-verify.md` / `references/non-interactive-contract.md`.
- **Agents run via the Workflow tool** (PHASE 1+2, PHASE 4); prompts passed **by pointer, never
  inline**; results schema-validated. Both workflow scripts **normalize `args`** at the top
  (`typeof args === "string" ? JSON.parse(args) : args`) — a runtime may deliver `args` as a JSON
  string. The Agent-tool path in each `agent-*.md` is the **fallback** (model override only there —
  it cannot set effort).

  | Agent            | Model    | Effort   | Why                                                           |
  | ---------------- | -------- | -------- | ------------------------------------------------------------- |
  | AGENT 1 build    | `sonnet` | `high`   | contract-driven TDD — feature.json + tests bound the work     |
  | AGENT 2 verify   | `opus`   | `high`   | the one independent adversarial judgment; backstops the build |
  | AGENT 3 refactor | `sonnet` | `medium` | test-guarded (revert-on-red), low risk                        |
  | AGENT S scanners | `sonnet` | `medium` | pattern-driven read-only fan-out                              |
  | Security triage  | `opus`   | `high`   | only pass without a test backstop — judgment over findings    |

> Full rationale (85/15 model, why fresh verify contexts, checkpoint durability, `.project/`
> sharing, prompt-by-pointer): `references/design-rationale.md`.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and
`completed` at the end. During context compaction the task list remains visible.

**Durable checkpoint (pause/resume across sessions)** — the `TaskCreate` list survives compaction
but not a crash/credits-exhaustion. So the orchestrator also mirrors the run to
`.project/session/ship-{feature}.json` at every phase boundary via `ship-checkpoint.js`, recording
the phase pointer, PHASE 0 selections (`SHIP_PLAN`), and agent results. **Only the main chat writes
it** (subagents never touch it — contract rule 1). The first write is the light checkpoint at the
plan gate, so even a define-then-crash resumes; the PHASE 2→3 boundary is a **deliberate handoff
stop** (park + fresh-session resume — see the green branch). Resume detection, the fast-path
direct-resume, write points 0–5, orphan-cleanup, and the board's **parked** row are fully specified
in `shared/SHIP-CHECKPOINT.md` — this skill follows it; the per-phase field patches below are the
only checkpoint detail restated here.

1. PHASE 0: Define + Classify + Auto-derive technique plan
2. PHASE 1: Build (AGENT 1)
3. PHASE 2: Auto-verify (AGENT 2)
4. PHASE 3: Manual tests + Completion
5. PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S] + Finalize/merge
6. PHASE 5: Report

### PHASE 0: Define + Classify + Auto-derive technique plan

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred
> and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above).
> Mark PHASE 0 → `in_progress` via `TaskUpdate`.
> Read `.claude/skills/dev-ship/references/phase-0-define-classify.md` and follow it — its **Step 0**
> runs checkpoint-resume detection + preflight (per `shared/SHIP-CHECKPOINT.md`) **before** resolving
> the feature. On a Resume, jump to the checkpoint's recorded phase instead of running PHASE 0 fresh
> (direct, no prompt, when the fast-path conditions hold — explicit arg, matching pipeline, running,
> ≤ 24h).

Resolves the feature, runs `dev-define` inline (interactive, main chat) when it is not yet
DEFINED, then computes the advisory `verificationProfile` and **auto-derives** the technique plan
(refactor lenses + relevant OWASP scanners) from the feature's signals — **no technique menu, no
policy prompt**. define is the only human touchpoint; the derived `refactorLenses`/`securityDeep`
become parameters for AGENT 3 / the trigger for AGENT S and are stored in memory for the later phases.
PHASE 0 ends with the **plan-approval gate** (Step 4b of the reference): the full plan is presented
in plan mode as a plan file whose appendix holds the complete feature.json draft, and the user accepts
it — on **accept** the draft is extracted to `feature.json` (it is not written before this) and build
starts; **reject** returns to the define interview to revise. A re-invoked feature that is already
`DEFINED` means a prior run already accepted the gate, so it skips the gate and flows straight to build
(the resume-recovery path).

It also assembles **`SHIP_CONTEXT`** (Step 6 of the reference) — one project-context block built
here from the external `shared/PROJECT-CONTEXT-LOAD.md` (build profile) + `shared/LEARNINGS-LOAD.md`
(scoped). This block is passed as a **per-agent slice** (see the reference's Per-agent slices table) into
each PHASE 1/2/4 agent's **pointer file** — AGENT S gets `OWASP_CONTEXT` instead — so no agent
re-bootstraps its own context; the main chat is the context-hub. Each `agent-*.md` § Spawn documents
the pointer-file template that carries this slice.

### PHASE 1+2: Build (AGENT 1) → Auto-verify (AGENT 2) — Workflow 1

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`. Rewrite the board live-signal:
> `echo '{"feature":"{feature}","skill":"build","startedAt":"{ISO}"}' > .project/session/active-{feature}.json`
> (the agents' copied workflows keep it fresh during their runs), and **update the checkpoint**
> (`shared/SHIP-CHECKPOINT.md` atomic write): `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`.
> Read `.claude/skills/dev-ship/references/agent-build.md` and
> `.claude/skills/dev-ship/references/agent-verify.md` (their **§ Spawn → Pointer file** templates
> only — do **not** read `non-interactive-contract.md` or the `references/prompts/*` bodies; the
> agents read those themselves). **Write each pointer + SHIP_CONTEXT-slice file** —
> `.project/session/ship-prompts/{feature}-build.txt` and `-verify.txt` — keeping the literal
> `{worktreePath}` placeholder in the verify file (the script fills it), and pass the **paths**
> (never inline). Then launch:
> `Workflow({scriptPath: ".claude/skills/dev-ship/references/workflows/ship-phase12.js", args: {feature, buildPromptPath, verifyPromptPath, resume}})`
> — `resume` is `null` on a fresh run, or the **green** results `{build, verify}` from the
> checkpoint on a Resume (the script short-circuits green results and re-runs anything failed).
> **Immediately after launch**, write the returned `runId` + `activeWorkflow: "phase12"` + the
> prompt-file **paths** as `prompts` to the checkpoint (so a mid-workflow crash is resumable via
> `resumeFromRunId`; the prompt files persist for reassembly).

The workflow runs both agents sequentially in isolated contexts with the model/effort matrix
(§ Design) and returns one structured object — no result-block parsing. AGENT 1 runs `dev-build`
non-interactively: creates the worktree, builds test-first, commits — but **never merges**.
AGENT 2 runs `dev-verify` for the AUTO/COVERED items only, in a **fresh context**
(unbiased/adversarial), in the existing worktree — and **stops before PHASE Finalize** (never
merges). Its prompt instructs it to refresh mutable context (learnings/architecture) from
`.project/` itself — the main chat is not in the loop between build and verify. The script skips
verify when build fails.

On the workflow return, first **update the checkpoint** (clear
`activeWorkflow`/`workflowRunId`/`prompts`, merge the returned `build`/`verify` objects into
`results`), then branch:

**Empty-input safety net** (rare, check first): the script normalizes `args` (§ Design), so the
string-delivery failure is handled at the source. If an agent _still_ reports no/`undefined` input
(`testsTotal: 0`, no worktree created), retry once via the Agent-tool fallback below before routing
anywhere. Only a genuine code/test failure follows the branches below.

- `status: green` → mark PHASE 1 **and** PHASE 2 `completed`; checkpoint `phase: "PHASE 3"`,
  `completedPhases += ["PHASE 1", "PHASE 2"]`. **Re-read `.project/` from disk.**
  `verify.remainingManualItems` is authoritative for PHASE 3, and it decides how PHASE 3 begins:
  - **`remainingManualItems` empty** (the ~85% case — no interactive work) → continue inline into
    PHASE 3 (Step 1 enter worktree + Step 3 completion). No handoff: there is nothing to justify a
    session break.
  - **`remainingManualItems` non-empty** → **hand off to a fresh session (token break).** PHASE 3 is
    an interactive main-chat phase; running it on top of the whole build+verify transcript is
    expensive, so park the run and let the user resume it cheaply:
    1. The checkpoint already carries `phase: "PHASE 3"` (just written) — the fast-path direct resume
       (SHIP-CHECKPOINT.md) will route a fresh `/dev-ship {feature}` straight into the manual round.
    2. `rm -f .project/session/active-{feature}.json` so the board renders this run as a **parked**
       row with the `/dev-ship {feature}` resume button (a checkpoint with no live signal = parked).
    3. Leave the PHASE 3 task `pending` and **end the turn** with the handoff message below — no
       further tool calls. PHASE 3/4/5 run in the fresh session. Emit it in the runtime language
       (LANGUAGE.md); this template is the English source:
       ```
       PHASE 1+2 green — {testsTotal} tests pass, {N} manual items remain.
       To keep this chat cheap the run stops here; the checkpoint is ready to resume.

       → Run /clear (or open a new chat), then: /dev-ship {feature}
         You land directly in the manual-test round (worktree + app are relaunched automatically).

       The board shows this run as parked (⏸) with the same resume button.
       Prefer to continue here instead? Say so and I'll run PHASE 3 in this session.
       ```
    - **Same-session escape hatch**: if the user replies "continue here" (or equivalent), skip the
      handoff — re-arm the live signal and run PHASE 3 inline per the section below.
- `failedPhase: "build"` → leave PHASE 1 `in_progress`; checkpoint `status: "failed"`, skip to
  PHASE 5: "Build failed at `{build.failedAt}`, worktree intact at `{build.worktreePath}` — run
  `/dev-debug {feature}`, or re-run `/dev-ship {feature}` to resume."
- `failedPhase: "verify"` → mark PHASE 1 `completed`, leave PHASE 2 `in_progress`; checkpoint
  `status: "failed"`, `completedPhases += ["PHASE 1"]`, skip to PHASE 5: "Auto-verify failed at
  `{verify.failedAt}`, worktree intact — run `/dev-debug {feature}`, or re-run `/dev-ship {feature}`
  to resume." Do not finalize.

**Fallback** (Workflow tool unavailable): spawn AGENT 1 then AGENT 2 sequentially via the Agent
tool per the Spawn sections in `agent-build.md` / `agent-verify.md` (models per the § Design
matrix, effort not settable), rebuild the verify-slice + worktree path in the main chat between
the two spawns, and parse the `SHIP_*_RESULT` blocks. On a **Resume**, skip any spawn whose result
is already in the checkpoint's `results` (`resumeFromRunId` does not apply to the Agent-tool path).

### PHASE 3: Manual tests + Completion (MAIN CHAT)

> **Todo**: mark PHASE 3 → `in_progress` (PHASE 1+2 were already flipped on the workflow return).
> Rewrite the board live-signal with `skill: "verify"` (same `active-{feature}.json` write as PHASE 1),
> and update the checkpoint `phase: "PHASE 3"`.
> **Worktree path guard (PHASE 3 + 4):** cwd is now inside the worktree, and `.project/session/` is
> worktree-local (not symlinked). The checkpoint is written via `ship-checkpoint.js`, which resolves
> main_root itself — safe from any cwd. But the `active-{feature}.json` **live-signal** is a plain
> write: target the **main checkout's** `.project/session/` (per `shared/DEVINFO.md § Active Feature
Signal` worktree caveat), else the board reads the wrong (worktree-local) copy.
> With non-empty `remainingManualItems` you normally
> arrive here **from a fresh session** (the green branch's handoff parked the run) via the reference's
> **Resume entry** note — re-enter the worktree + relaunch the app first — or from the same-session
> **escape hatch** (the user chose to continue here). Either way re-arm the live signal, then proceed.
> If AGENT 2 returned `remainingManualItems` (non-empty) → Read
> `.claude/skills/dev-ship/references/phase-3-manual-finalize.md` and run the manual walkthrough
> then the completion (DONE write). If empty → Read the same file and execute Step 1 (enter worktree)
> then Step 3 (Completion — the completion-sync DONE write only); skip only Step 2 (the manual
> walkthrough).

Manual tests run in the main chat (you), so `AskUserQuestion` reaches the real user — the whole
checklist is presented once and judged in one batched round (see
`references/manual-batch-walkthrough.md`). On all-green (or empty), complete the feature (DONE write)
and **stay in the worktree** — finalize/merge runs at the end of PHASE 4 so refactor commits land on
the feature branch. On a manual FAIL, the reference's routing question decides: an isolated
background fix agent (re-test, max 2 rounds), interactive `/dev-debug`, or stop — no refactor/finalize
until the failed items pass.

### PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S] + Finalize/merge — Workflow 2

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`; update the checkpoint
> `phase: "PHASE 4"`, `completedPhases += ["PHASE 3"]` (the feature is DONE and verified, still on
> the feature branch in the worktree — not yet merged). Refactor always runs (auto-derived lenses);
> skip straight to the finalize step below **only** if the `--no-refactor` escape hatch was set
> **and** `securityDeep` is empty.
> **Before spawning**: (a) capture the revert anchor
> `preRefactorSha = git -C {worktreePath} rev-parse HEAD` and write it to the checkpoint; (b) run the
> TEAM_MODE + PR-state detection from `references/dev-verify/references/finalize.md` and set
> `finalizeRoute: merge | halt` (`merge` on the solo/`MERGED` rows, `halt` on the open-PR / team rows)
> — this decides whether AGENT 3 does the shipped completion writes.
> Otherwise rewrite the board live-signal with `skill: "refactor"` (same `active-{feature}.json`
> write as PHASE 1), then Read `.claude/skills/dev-ship/references/agent-refactor.md` (when refactor runs) and
> `.claude/skills/dev-ship/references/agent-security.md` (when `securityDeep` is non-empty) — their
> **§ Spawn → Pointer file** templates only; the `prompts/*` bodies are read by the agents.
> Rebuild the **refactor-slice** from the post-verify `.project/` (shared into the worktree via
> symlinks — built files + fresh learnings), **write each pointer + slice file** (carrying the
> worktree path + `finalizeRoute`) under `.project/session/ship-prompts/`
> and pass the **paths** (never inline — see PHASE 1+2), then launch:
> `Workflow({scriptPath: ".claude/skills/dev-ship/references/workflows/ship-phase4.js", args: {feature, refactorPromptPath, scanners, triagePromptPath, resume}})`
> — with `refactorPromptPath: null` only when the `--no-refactor` escape hatch was set, `scanners: []`
> when `securityDeep` is empty (`scanners` = one `{code, promptPath}` per auto-derived OWASP code, each scanner prompt per
> `agent-security.md` written to its own file; `triagePromptPath` = a pointer file per its § Triage section,
> pointing the triage agent at `references/prompts/security-triage.md`), and
> `resume` = `null` fresh or the **completed** results `{refactor, triage}` from the checkpoint on a
> Resume (a failed refactor re-runs). `ship-phase4.js` normalizes `args` like `ship-phase12.js`; the
> same PHASE 1+2 empty-input safety net applies if an agent still reports no input.
> **Immediately after launch** write the returned `runId` +
> `activeWorkflow: "phase4"` + the prompt-file **paths** as `prompts` to the checkpoint. On return:
> clear `activeWorkflow`/`workflowRunId`/`prompts`, merge `refactor`/`triage` into `results`. If
> `refactor.status: failed` → revert the branch (`git -C {worktreePath} reset --hard {preRefactorSha}`,
> non-fatal, record for the report). **Then finalize** — Read
> `.claude/skills/dev-ship/references/dev-verify/references/finalize.md` and execute it (solo → merge
> to main + worktree cleanup via `shared/FINALIZE.md`; open PR / team → halt with the printed message
> and leave the worktree — refactor commits are already on the branch/PR). Only after finalize (or
> halt): checkpoint `phase: "PHASE 5"`, `completedPhases += ["PHASE 4"]`, **re-read `.project/` from
> disk**.

The workflow runs AGENT 3 (pre-merge, inside `worktree-{feature}` on the feature branch) in
**parallel** with the selected OWASP scanners (read-only, no `.project/` writes; they scan the
worktree copies — `<reference-paths>` are prefixed with `{worktreePath}`, see `agent-security.md`),
then one **opus triage pass** over the merged findings (confidence ≥ 60%): dedup, false-positive
verdicts, prioritization. AGENT 3 runs `dev-refactor` on this single feature with the **auto-derived
lenses**, applying only high-confidence findings, test-guarded (revert-on-red) — no pre-build
intensity toggle. **No auto-fix in hands-off** — `triage` output is surfaced in PHASE 5.
`refactor.status: failed` is **non-fatal** — revert the branch to `preRefactorSha` and still finalize
the verified feature; surface the failure for manual follow-up.
**Guard** — never finalize before the refactor workflow returns; never skip finalize because refactor
failed. The finalize step above runs on both the `applied|clean` and the reverted-`failed` path.

**Fallback** (Workflow tool unavailable): spawn AGENT 3 + the scanners via the Agent tool per
`agent-refactor.md` / `agent-security.md` (models per the § Design matrix), parse the
`SHIP_*_RESULT` blocks, and run the triage judgment inline in the main chat over the
threshold-filtered findings.

### PHASE 5: Report

> **Todo**: mark the phases that actually ran → `completed` (on a failure-jump, leave the failed
> phase `in_progress` and never mark a skipped phase `completed`), PHASE 5 → `in_progress`.
> **Board cleanup** (every exit path, success or failure): `rm -f .project/session/active-{feature}.json`,
> and if the feature still exists in `backlog.json#features[]` with `transition: "shipping"`, remove
> that `transition` (on full success refactor's completion-batch already shipped + cleared it; this
> catches failure-jumps and the `--no-refactor` escape hatch).
> **Checkpoint cleanup** — asymmetric with the board signal (per `shared/SHIP-CHECKPOINT.md`): on a
> green completion set the checkpoint `status: "complete"` then `rm -f .project/session/ship-{feature}.json`.
> On a **failure-jump, leave the checkpoint on disk** (`status: "failed"`) so `/dev-ship {feature}`
> can resume; surface its `baselineSha` in the failure report as the rollback anchor.

Print the ship summary (ASCII table): feature, build test counts, verify results, manual outcomes,
refactor result, security findings (if any), and the collected `autoDecisions[]` (choices the
agents auto-made in non-interactive mode) for your review.

```
SHIP COMPLETE: {feature}
========================
Plan:     auto-derived → lenses {refactorLenses} · security {securityDeep or "none"}
Build:    {passed}/{total} PASS
Verify:   AUTO {n} PASS · MANUAL {n} ({pass}/{fail}/{skip}/{defer})
Refactor: {lenses applied} · {techniques} applied ({reverted} reverted)
Security: {triage: {confirmed} confirmed · {dismissed} dismissed, or "not run"}
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
