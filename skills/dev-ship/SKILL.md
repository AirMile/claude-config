---
name: dev-ship
description: Use to run define→build→verify→refactor as one auto-mode flow. Use with /dev-ship.
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
writes: [feature.verificationProfile, project-context.learnings]
metadata:
  author: claude-config
  version: 0.2.0
  category: dev
---

# Ship (auto-mode pipeline)

Runs the full dev pipeline — **define → build → verify → refactor** — in one chat. Heavy work
runs in isolated inline agents (context stays clean); only human interaction (define choices,
manual tests) happens in the main chat. Does **not** replace the classic 4-skill pipeline — it
orchestrates the existing skills via reuse. Old `/dev-define`→`/dev-build`→… stay untouched.

**Trigger**: `/dev-ship` or `/dev-ship {feature-name}`

## Design

- **One human touchpoint up front** (PHASE 0: define + technique selection), then hands-off —
  except the conditional manual-test interlude (PHASE 3).
- **85/15 is one flow, not two paths.** PHASE 3 either has manual items or falls through to just
  the merge. The `verificationProfile` computed in PHASE 0 is an **advisory estimate**; AGENT 2's
  returned `remainingManualItems` is authoritative for PHASE 3.
- **Build and verify are separate agents (separate context windows)** — a fresh verify agent is
  unbiased/adversarial, which is the whole value of verify. See `references/agent-verify.md`.
- **`.project/` is shared on disk between agents; context is isolated.** The flow is sequential →
  one writer at a time → no write-races. Re-read `.project/` from disk after every agent return.
  See `references/non-interactive-contract.md`.
- **Agents run via the Workflow tool** (two runs: PHASE 1+2 and PHASE 4) with a per-agent
  model + effort matrix and schema-validated structured results (no result-block parsing). The
  Agent-tool spawn path in each `agent-*.md` is the **fallback** when the Workflow tool is
  unavailable (model override only — the Agent tool cannot set effort).

  | Agent            | Model    | Effort   | Why                                                           |
  | ---------------- | -------- | -------- | ------------------------------------------------------------- |
  | AGENT 1 build    | `sonnet` | `high`   | contract-driven TDD — feature.json + tests bound the work     |
  | AGENT 2 verify   | `opus`   | `high`   | the one independent adversarial judgment; backstops the build |
  | AGENT 3 refactor | `sonnet` | `medium` | test-guarded (revert-on-red), low risk                        |
  | AGENT S scanners | `sonnet` | `medium` | pattern-driven read-only fan-out                              |
  | Security triage  | `opus`   | `high`   | only pass without a test backstop — judgment over findings    |

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and
`completed` at the end. During context compaction the task list remains visible.

**Durable checkpoint (pause/resume across sessions)** — the `TaskCreate` list survives compaction
but **not** a crash or credits-exhaustion that ends the session. So the orchestrator also mirrors
the run to an on-disk checkpoint (`.project/session/ship-{feature}.json`) at every phase boundary,
per `shared/SHIP-CHECKPOINT.md`. This records the phase pointer, the PHASE 0 selections
(`SHIP_PLAN`), and each agent's structured result — the state that otherwise lives only in this
context. Any interruption becomes a resumable pause: re-invoking `/dev-ship {feature}` detects the
checkpoint (PHASE 0) and offers Resume/Restart/Inspect. Only the main chat writes it (subagents
never touch it — contract rule 1).

1. PHASE 0: Define + Classify + Technique menu
2. PHASE 1: Build (AGENT 1)
3. PHASE 2: Auto-verify (AGENT 2)
4. PHASE 3: Manual tests + Finalize/merge
5. PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S]
6. PHASE 5: Report

### PHASE 0: Define + Classify + Technique menu

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred
> and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above).
> Mark PHASE 0 → `in_progress` via `TaskUpdate`.
> Read `.claude/skills/dev-ship/references/phase-0-define-classify.md` and follow it — its **Step 0**
> runs checkpoint-resume detection + preflight (per `shared/SHIP-CHECKPOINT.md`) **before** resolving
> the feature. On a Resume, jump to the checkpoint's recorded phase instead of running PHASE 0 fresh.

Resolves the feature, runs `dev-define` inline (interactive, main chat) when it is not yet
DEFINED, then computes the advisory `verificationProfile` and presents the auto-suggested technique
menu (refactor lenses + relevant OWASP categories + refactor policy). Selections become parameters
for AGENT 3 and the trigger for AGENT S — they are stored in memory for the later phases.

It also assembles **`SHIP_CONTEXT`** (Step 6 of the reference) — one project-context block built
here from the external `shared/PROJECT-CONTEXT-LOAD.md` (build profile) + `shared/LEARNINGS-LOAD.md`
(scoped). This block is passed as a **per-agent slice** (see the reference's Per-agent slices table) into
each PHASE 1/2/4 agent prompt — AGENT S gets `OWASP_CONTEXT` instead — so no agent
re-bootstraps its own context; the main chat is the context-hub. The agent references already carry
the `{paste the SHIP_CONTEXT block …}` slot.

### PHASE 1+2: Build (AGENT 1) → Auto-verify (AGENT 2) — Workflow 1

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`. Rewrite the board live-signal:
> `echo '{"feature":"{feature}","skill":"build","startedAt":"{ISO}"}' > .project/session/active-{feature}.json`
> (the agents' copied workflows keep it fresh during their runs), and **update the checkpoint**
> (`shared/SHIP-CHECKPOINT.md` atomic write): `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`.
> Read `.claude/skills/dev-ship/references/agent-build.md`,
> `.claude/skills/dev-ship/references/agent-verify.md` and
> `.claude/skills/dev-ship/references/non-interactive-contract.md`. Assemble **both** prompts from
> their templates (contract inlined, SHIP_CONTEXT slice pasted per agent; keep the literal
> `{worktreePath}` placeholder in the verify prompt — the script fills it). Then launch:
> `Workflow({scriptPath: ".claude/skills/dev-ship/references/workflows/ship-phase12.js", args: {feature, buildPrompt, verifyPromptTemplate, resume}})`
> — `resume` is `null` on a fresh run, or the **green** results `{build, verify}` from the
> checkpoint on a Resume (the script short-circuits green results and re-runs anything failed).
> **Immediately after launch**, write the returned `runId` + `activeWorkflow: "phase12"` + the
> assembled prompt args as `prompts` to the checkpoint (so a mid-workflow crash is resumable via
> `resumeFromRunId`, with the exact original prompts).

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

- `status: green` → mark PHASE 1 **and** PHASE 2 `completed`; checkpoint `phase: "PHASE 3"`,
  `completedPhases += ["PHASE 1", "PHASE 2"]`. **Re-read `.project/` from disk.**
  `verify.remainingManualItems` is authoritative for PHASE 3. Continue.
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

### PHASE 3: Manual tests + Finalize/merge (MAIN CHAT)

> **Todo**: mark PHASE 3 → `in_progress` (PHASE 1+2 were already flipped on the workflow return).
> Rewrite the board live-signal with `skill: "verify"` (same `active-{feature}.json` write as PHASE 1),
> and update the checkpoint `phase: "PHASE 3"` (the manual walkthrough resumes from
> `results.verify.remainingManualItems` if interrupted here).
> If AGENT 2 returned `remainingManualItems` (non-empty) → Read
> `.claude/skills/dev-ship/references/phase-3-manual-finalize.md` and run the manual walkthrough
> then finalize. If empty → Read the same file and execute Step 1 (enter worktree) then Step 3
> (Completion + Finalize, **both** items — the completion-sync DONE write and the finalize/merge);
> skip only Step 2 (the manual walkthrough).

Manual tests run in the main chat (you), so `AskUserQuestion` reaches the real user. On all-green
(or empty), finalize = merge + remove worktree via the reused `dev-verify` finalize flow. On a
manual FAIL: do not finalize, do not refactor — report + hand to `/dev-debug`/`/dev-verify`.

### PHASE 4: Refactor (AGENT 3) [+ optional security AGENT S] — Workflow 2

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`; update the checkpoint
> `phase: "PHASE 4"`, `completedPhases += ["PHASE 3"]` (feature is now merged on `main`). If
> `SHIP_PLAN.refactorPolicy == skip` **and** `securityDeep` is empty → skip straight to PHASE 5.
> Otherwise rewrite the board live-signal with `skill: "refactor"` (same `active-{feature}.json`
> write as PHASE 1), then Read `.claude/skills/dev-ship/references/agent-refactor.md` (when refactor runs) and
> `.claude/skills/dev-ship/references/agent-security.md` (when `securityDeep` is non-empty).
> Rebuild the **refactor-slice** from the just-read post-merge `.project/` (built files + fresh
> learnings), assemble the prompts, then launch:
> `Workflow({scriptPath: ".claude/skills/dev-ship/references/workflows/ship-phase4.js", args: {feature, refactorPrompt, scanners, triagePromptTemplate, resume}})`
> — with `refactorPrompt: null` when `refactorPolicy == skip`, `scanners: []` when `securityDeep`
> is empty (`scanners` = one `{code, prompt}` per selected OWASP code, prompt per
> `agent-security.md`; `triagePromptTemplate` per its § Triage section), and `resume` = `null`
> fresh or the **completed** results `{refactor, triage}` from the checkpoint on a Resume (a failed
> refactor re-runs). **Immediately after launch** write the returned `runId` +
> `activeWorkflow: "phase4"` + the assembled prompt args as `prompts` to the checkpoint. On return:
> clear `activeWorkflow`/`workflowRunId`/`prompts`, merge `refactor`/`triage` into `results`,
> checkpoint `phase: "PHASE 5"`, `completedPhases += ["PHASE 4"]`.

The workflow runs AGENT 3 (post-merge, on main) in **parallel** with the selected OWASP scanners
(read-only, no `.project/` writes), then one **opus triage pass** over the merged findings
(confidence ≥ 60%): dedup, false-positive verdicts, prioritization. AGENT 3 runs `dev-refactor`
on this single feature with the selected lenses and policy (`conservative` default), test-guarded.
**No auto-fix in hands-off** — `triage` output is surfaced in PHASE 5. `refactor.status: failed`
is **non-fatal** (the feature is already merged) — surface it for manual follow-up.
**Re-read `.project/` from disk** before continuing.

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
> catches failure-jumps and `refactorPolicy: skip`).
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
