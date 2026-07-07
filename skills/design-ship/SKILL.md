---
name: design-ship
description: Use to run design build→content→check as one auto-mode flow. Use with /design-ship.
argument-hint: "[page-or-component-name]"
reads:
  [
    backlog.status,
    project.design,
    project.theme,
    project.stack,
    concept.seed,
    devinfo.tokenDrift,
    feature.requirements,
    feature.files,
  ]
writes:
  [
    backlog.status,
    backlog.lastCheckedSha,
    backlog.shipped,
    project.design,
    project.theme,
    devinfo.tokenDrift,
  ]
metadata:
  author: claude-config
  version: 0.4.1
  category: design
---

# Ship (design auto-mode pipeline)

Runs the design pipeline — **build → content → check** — in one chat for a single PAGE or
COMPONENT. Heavy work runs in isolated inline agents (context stays clean); human interaction is
front-loaded (PHASE 0: spec, design direction, content brief) plus one **visual review against the
live page** at the end (PHASE 4). `design-ship` is **standalone**: it carries its own vendored
copies of the build/content/check phase logic under `references/design-{create,content,check}/` and
drives them internally — it no longer reads any standalone skill in place. Interactive/visual work
stays outside it: sketch/Figma/URL→code and design-spec management live in `/design-convert`,
content-fill in `/design-content`.

**Trigger**: `/design-ship` or `/design-ship {page-or-component-name}`

**Scope**: Build lane only (spec → code), **web only**. Visual input (sketch/Figma/screenshot) is
inherently interactive → `/design-convert` Convert. THEME → `/design-tokens`. Dev-track features →
`/dev-ship`.

## Design

- **Two human touchpoints.** PHASE 0 front-loads every design decision — the design direction is
  presented **visually** (side-by-side HTML preview via `shared/HTML-PRESENT.md` + the ASCII
  modal). PHASE 4 reviews the merged outcome as a **live page** (real dev server, not a
  screenshot) with the copy before→after table and the audit verdict — including a bounded copy
  regenerate loop.
- **Copy is auto-applied, review is deferred.** AGENT 2 applies everything and returns
  `copyTable[]`; the user judges copy in context (on the live page) instead of in an abstract
  approval table mid-flow.
- **Check is fully autonomous.** AGENT 3 auto-scopes, picks its own fix scope (All
  CRITICAL + HIGH), re-audits, and reports `readyForDone` — no fix-approval modal. It runs in a
  **fresh context** (unbiased toward the build).
- **One worktree, one merge.** AGENT 1 creates it, AGENT 2/3 commit in it, the main chat merges in
  PHASE 4 after the review. No agent ever merges (see `references/non-interactive-contract.md`).
- **`.project/` is shared on disk between agents; context is isolated.** The flow is sequential →
  one writer at a time → no write-races. Re-read `.project/` from disk after every agent return.
- **Agents run via the Workflow tool** (one run: PHASE 1–3) with a per-agent model + effort matrix
  and schema-validated structured results. **Prompts are passed by pointer, never inline** — the
  static agent instruction bodies live in `references/prompts/{build,content,check}.md` and the
  spawned agent reads them itself (plus `non-interactive-contract.md`, which it also reads). The
  main chat writes only a small **pointer + dynamic SHIP_CONTEXT slice** file to
  `.project/session/ship-prompts/` and passes the path in `args` — it does **not** read the
  `prompts/*` bodies or the contract. Some runtimes deliver the `args` global to the script as a
  **JSON string** rather than an object (then every `args.x` is `undefined`), so the workflow script
  **normalizes `args` at the top** (`typeof args === "string" ? JSON.parse(args) : args`) — the
  primary Workflow path is reliable. The Agent-tool spawn path in each `agent-*.md` is the
  **fallback**, used only when the Workflow tool is unavailable.

  | Agent           | Model    | Effort   | Why                                                             |
  | --------------- | -------- | -------- | --------------------------------------------------------------- |
  | AGENT 1 build   | `sonnet` | `high`   | direction + spec bound the codegen; token decisions are binding |
  | AGENT 2 content | `sonnet` | `medium` | brief-bound copy generation, KEEP-markers guard the rest        |
  | AGENT 3 check   | `opus`   | `high`   | the one independent quality judgment; picks fixes itself        |

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and
`completed` at the end. During context compaction the task list remains visible.

**Durable checkpoint (pause/resume across sessions)** — the `TaskCreate` list survives compaction
but not a crash/credits-exhaustion. So the orchestrator also mirrors the run to
`.project/session/ship-{target}.json` at every phase boundary via `ship-checkpoint.js`, recording
the phase pointer, the full PHASE 0 objects (direction incl. token decisions + layout, archetype,
brief, checkScope, composition, inline spec), and agent results. **Only the main chat writes it**
(subagents never touch it — contract rule 1). Unlike dev/game there is no light plan-gate checkpoint:
the first write lands **post-gate** at Step 9 — the PHASE 0 selections are irreproducible user
choices. The checkpoint schema, write points 0–5, and the board's **parked** row are specified in
`shared/SHIP-CHECKPOINT.md`; resume detection, the fast-path direct-resume, and orphan-cleanup live in
`shared/SHIP-RESUME.md` (the cheap resume path). This skill follows both; the per-phase field patches
below are the only checkpoint detail restated here.

1. PHASE 0: Target + Direction + Brief
2. PHASE 1: Build (AGENT 1)
3. PHASE 2: Content (AGENT 2)
4. PHASE 3: Check (AGENT 3)
5. PHASE 4: Visual review + Finalize/merge
6. PHASE 5: Report

### PHASE 0: Target + Direction + Brief

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred
> and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above).
> Mark PHASE 0 → `in_progress` via `TaskUpdate`.
> **Then route in two steps** (the resume path skips the fresh-run PHASE 0 file):
>
> 1. **Resume check first.** If `/design-ship` was called with an **explicit** `{target}` arg and
>    `test -f .project/session/ship-{target}.json` succeeds → Read
>    `.claude/skills/shared/SHIP-RESUME.md` and follow it. The fast path jumps straight to the
>    recorded phase (no prompt when explicit arg + matching pipeline + running + ≤ 24h) — so a parked
>    resume lands in the PHASE 4 review **without** loading `phase-0-direction-brief.md`. (Only
>    "Restart fresh" falls through to step 2.)
> 2. **Fresh / no-arg / no checkpoint** → Read
>    `.claude/skills/design-ship/references/phase-0-direction-brief.md` and follow it from Step 0 (it
>    resolves the target, delegates resume detection to `SHIP-RESUME.md`, then runs preflight +
>    direction/brief for a fresh run).

Resolves the target (arg → board `shipping` pickup → candidates), gates the spec, composes 2-3
design directions and presents them **visually** (browser preview + modal), derives + confirms the
content brief, auto-derives the check scope, sets the board state (`transition: "shipping"` + live
signal), and assembles **`SHIP_CONTEXT`** with per-agent slices. Each `agent-*.md` § Spawn documents
the pointer-file template that carries its slice into the agent.

### PHASE 1–3: Build → Content → Check — one Workflow

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`; update the checkpoint
> (`shared/SHIP-CHECKPOINT.md` atomic write) `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`. Read
> `.claude/skills/design-ship/references/agent-build.md`,
> `.claude/skills/design-ship/references/agent-content.md` and
> `.claude/skills/design-ship/references/agent-check.md` (their **§ Spawn → Pointer file** templates
> only — do **not** read `non-interactive-contract.md` or the `references/prompts/*` bodies; the
> agents read those themselves). **Write each pointer + SHIP_CONTEXT-slice file** under
> `.project/session/ship-prompts/` — keeping the literal `{worktreePath}` placeholder in the content
>
> - check files (the agent substitutes it) — and pass the **paths** (never inline). Then launch:
>   `Workflow({scriptPath: ".claude/skills/design-ship/references/workflows/ship-design-phase123.js", args: {feature, buildPromptPath, contentPromptPath, checkPromptPath, resume}})`
>   — `resume` = `null` on a fresh run, or the **green** results `{build, content, check}` from the
>   checkpoint on a Resume (the script short-circuits green results and re-runs anything failed or
>   degraded). **Immediately after launch** write the returned `runId` + `activeWorkflow: "design123"`
>
> * the prompt-file **paths** as `prompts` to the checkpoint (so a mid-workflow crash is resumable
>   via `resumeFromRunId`; the prompt files persist for reassembly).

The workflow runs the three agents sequentially in isolated contexts with the model/effort matrix
(§ Design) and returns one structured object — no result-block parsing. Each agent rewrites the
board live-signal with its own verb on start (contract rule 12), so the board badge follows
build → content → check without the main chat in the loop. Content failure is **non-fatal**
(`contentDegraded: true`) — the run continues with placeholder copy and the PHASE 4 review offers
regeneration.

On the workflow return, first **update the checkpoint** (clear
`activeWorkflow`/`workflowRunId`/`prompts`, merge the returned `build`/`content`/`check` objects
into `results`), then branch:

**Empty-input safety net** (rare, check first): the script normalizes `args` (§ Design), so the
string-delivery failure is handled at the source. If an agent _still_ reports no/`undefined` input
(empty message, no files, no worktree created), retry once via the Agent-tool fallback below before
routing anywhere. Only a genuine build/check failure follows the branches below.

- `status: green` → mark PHASE 1, 2 **and** 3 `completed` (note content degradation on PHASE 2 if
  any); checkpoint `phase: "PHASE 4"`, `completedPhases += ["PHASE 1", "PHASE 2", "PHASE 3"]`.
  **Re-read `.project/` from disk.** Continue to PHASE 4.
- `failedPhase: "build"` → leave PHASE 1 `in_progress`; checkpoint `status: "failed"`, skip to
  PHASE 5: "Build failed at `{build.failedAt}`, worktree intact at `{build.worktreePath}` — inspect
  it or run `/design-convert {target}` to patch, or re-run `/design-ship {target}` to resume."
- `failedPhase: "check"` → mark PHASE 1+2 `completed`, leave PHASE 3 `in_progress`; checkpoint
  `status: "failed"`, `completedPhases += ["PHASE 1", "PHASE 2"]`, skip to PHASE 5: "Check failed at
  `{check.failedAt}` (app does not build/serve), worktree intact — fix the build error, then
  re-run `/design-ship {target}` to resume." Do not finalize.

**Fallback** (Workflow tool unavailable): spawn AGENT 1 → 2 → 3 sequentially via the Agent tool
per the Spawn sections in the three `agent-*.md` files (models per the § Design matrix, effort not
settable), substitute `{worktreePath}` in the main chat after the build, and parse the
`SHIP_DESIGN_*_RESULT` blocks. On a **Resume**, skip any spawn whose result is already in the
checkpoint's `results` (`resumeFromRunId` does not apply to the Agent-tool path).

### PHASE 4: Visual review + Finalize/merge (MAIN CHAT)

> **Todo**: mark PHASE 4 → `in_progress`; update the checkpoint `phase: "PHASE 4"` (if interrupted
> here the review resumes from `results.check` / `results.content.copyTable`). Read
> `.claude/skills/design-ship/references/phase-4-review-finalize.md` and follow it.

The user reviews the live page (auto-opened), the copy table, and the audit verdict; can
regenerate copy (max 3 rounds); then ship = merge + backlog completion (DONE/shipped for PAGE,
lastCheckedSha for COMPONENT). On "hold"/"abort": no merge, worktree stays, cleanup still runs.

### PHASE 5: Report

> **Todo**: mark the phases that actually ran → `completed` (on a failure-jump, leave the failed
> phase `in_progress` and never mark a skipped phase `completed`), PHASE 5 → `in_progress`.
> **Board cleanup** (every exit path, success or failure): `node ~/.claude/scripts/ship-checkpoint.js signal-clear {target}`,
> and if the target still exists in `backlog.json#features[]` with `transition: "shipping"`, remove
> that `transition` (on full success PHASE 4 step 3 already cleared it; this catches failure-jumps
> and hold/abort exits).
> **Checkpoint cleanup** — asymmetric with the board signal (per `shared/SHIP-CHECKPOINT.md`): on a
> green completion set the checkpoint `status: "complete"` then `rm -f .project/session/ship-{target}.json`.
> On a **failure-jump, leave the checkpoint on disk** (`status: "failed"`) so `/design-ship {target}`
> can resume; surface its `baselineSha` in the failure report as the rollback anchor. A user
> **hold/abort** in PHASE 4 is not a failure — treat it as a pause: keep the checkpoint so the run
> can be resumed later.

Print the ship summary (runtime language per `CLAUDE.md → Language`):

```
SHIP COMPLETE: {target} ({targetType})
======================================
Direction: {$DESIGN_DIRECTION.name}
Build:     {filesCreated} file(s) · {tokensUsed} token refs · smoke {smoke}
Copy:      {itemsApplied} applied ({regenRounds} regen round(s)) | DEGRADED
Check:     {findingsResolved}/{findingsTotal} resolved · critical remaining: {n}
Merged:    {yes → main | no → {reason}}

Auto-decisions ({N}):
- {agent}: {decision}
```

**Ship-level learning extraction** (the layer the agents cannot see). The agents already wrote
their domain learnings/glossary during their phases. Cross-phase signals only exist here — extract
a small set (0-2) to `project-context.json#learnings[]` via `shared/LEARNING-WRITE.md`
(`source: "extracted"`, same dedup): a recurring `autoDecisions` pattern, a direction axis the
user consistently overrides, or copy the user regenerated repeatedly (signals a brief gap). Only
write genuinely reusable signals — skip if none. Then run the consolidation gate per
`shared/LEARNING-WRITE.md § Consolidation Gate` (trigger `> 60` → merge, archive, target ≤40).

> **Todo**: mark PHASE 5 → `completed`.

On any agent failure earlier in the flow, PHASE 5 still runs but reports the stop point and the
recovery command instead of a green summary.
