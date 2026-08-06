# PHASE 0 — Define + Classify + Auto-derive technique plan

The one interactive phase. All human decisions are front-loaded here; everything after runs
hands-off (except the conditional manual-test interlude in PHASE 3).

**Plan-mode shape (token efficiency).** The whole define thinking-block — interview, requirements,
architecture, classify, technique-derivation — runs **inside plan mode** (entered at Step 2b). Plan
mode blocks `.project/` and source writes — it is an approval gate, not a model router (the session
model is `opus` throughout) — so **all bookkeeping is hoisted to Step 2a (before plan mode)** and **all durable
artifacts are written at gate-accept (Step 4b, after plan mode exits)**. The gate is the single
review + go/no-go for the whole plan — reject loops back inside plan mode to revise. An unforeseen
non-deferrable write mid-define uses `shared/PLAN-MODE.md § Administrative exit` — exit with an
administrative note, write, and **re-enter plan mode before continuing the interview**.

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the feature, Read `.claude/skills/shared/SHIP-RESUME.md` and run its resume
detection against `.project/session/ship-{feature}.json` (use the resolved arg for `{feature}`; if
`/dev-ship` was called with no arg, first resolve the name via Step 1, then run this check). Normally
a fresh session with an explicit arg + an open checkpoint never reaches this file — `SKILL.md`
PHASE 0 routes it straight to `SHIP-RESUME.md` — so the cases that land here are: **no arg** (name
resolved above), a fast-path miss (`status: "failed"` / stale), or **no open checkpoint**.

- **Open checkpoint found** (`status != "complete"`) → follow `SHIP-RESUME.md`'s logic (fast path or
  the Resume/Restart/Inspect question, then the On-"Resume" jump to the recorded phase — dev phase
  map: `PHASE 3` → `phase-3-manual-finalize.md § Resume entry`; `PHASE 0 · define` → re-run define
  from the top, Step 1 below — the draft was authored in plan mode and is **not** durably
  checkpointed, so the interview re-runs; a workflow phase → its On-"Resume" step 4 relaunch). A
  **Restart** choice continues fresh below.
- **No open checkpoint** → run the **preflight checks** (merge/rebase-in-progress **hard stop**;
  dirty working tree; colliding `worktree-{feature}` from a prior aborted run without a checkpoint;
  per `SHIP-CHECKPOINT.md § Preflight`), surface any notice — a hard stop ends the turn with
  resolve instructions — then continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD`. It is written
to the checkpoint in Step 2a.

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `dev-define` PHASE 0 step 1 does (arg → backlog `transition`
match → first TODO → concept → suggestions), with one dev-ship-specific addition **before** the
define-style transition match: a feature with `transition: "shipping"` (queued via the board's
⚡ Ship (auto) menu item) wins the no-arg resolution — but only on **dev-track types**: skip
entries with `type === "PAGE"` or `"COMPONENT"` (those belong to `/design-ship`; `PAGE-GAP` is
dev-track and stays here). An arg that resolves to a `type === "TWEAK"` entry (a `/dev-tweak`
escalation handoff, per `shared/TWEAK-DISCIPLINE.md § Escalation gate`) is a normal resolution here —
no special-casing at this step; Step 4b's gate-accept sync is what promotes it out of `TWEAK` (see
`phase4-sync.md § TWEAK promotion`). Then check
`.project/features/{feature-name}/feature.json` to set the `defineNeeded` flag for the rest of PHASE 0:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → `defineNeeded = false`.
  The plan gate was **already accepted in a prior run** (feature.json is written only at gate-accept,
  so its presence means "past the gate"). Skip both define **and** the plan gate **and** plan mode
  (nothing to think — the plan re-derives deterministically from `feature.json`): do Step 2a
  (bookkeeping), then Step 3 → Step 4 → **Step 5** (skip Step 2b/2c and Step 4b). This is the
  resume-recovery path for the narrow window where a prior run accepted the gate but the checkpoint
  had not advanced past it (once the checkpoint exists, Step 0's direct resume catches it first).
- **Missing / not yet DEFINED** → `defineNeeded = true`. Full flow: Step 2a → 2b → 2c → 3 → 4 → 4b.

## Step 2a — Bookkeeping (before plan mode — runs on both branches)

Plan mode blocks `.project/` writes, so **every** bookkeeping write happens here, up front:

1. **Feature dir + session:** `mkdir -p .project/features/{feature-name} .project/session`.
2. **Live signal** — write the board's live signal with `skill: "define"`; add `"waiting": "define"`
   **only when `defineNeeded`** (the board then shows the run waiting for input through the whole
   interactive block):

   ```bash
   echo '{"skill":"define","waiting":"define"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}
   ```

   The later SKILL.md phase boundaries rewrite this same signal with `skill: build | verify | refactor`
   — the board badge follows the pipeline. (Define's own PHASE 0 §3 signal write is **skipped** —
   this is it; see Step 2c.)

3. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry. This keeps
   the card in the board's IN PROGRESS section between phases, when no agent is running. It is removed
   by refactor's completion-batch (feature shipped) or by PHASE 5 cleanup on every other exit path.
4. **Minimal light checkpoint** (SHIP-CHECKPOINT.md write point 0) — `init`
   `.project/session/ship-{feature}.json` with `pipeline: "dev"`, `feature`, `startedAt`/`updatedAt`,
   `status: "running"`, `phase: "PHASE 0 · define"`, `completedPhases: []`, `baselineSha` (from Step
   0), empty `results`/`prompts`, `activeWorkflow: null`, and `plan: {}`. This is the **last
   `.project/` write before plan mode**. It marks the run started (so the board shows it **parked** if
   the session dies) and durably anchors the rollback SHA. It deliberately holds **no** feature draft:
   the draft is authored inside plan mode and cannot reach disk until accept (see the § Resume note at
   Step 4b for what a mid-define death costs).

**If `defineNeeded == false`** (Step 1 DEFINED branch) → continue to **Step 3** (no plan mode, no
define — Step 3 re-derives from `feature.json`).

### Step 2b-2c — Enter plan mode + run dev-define inline (only when `defineNeeded`)

Read `.claude/skills/dev-ship/references/phase-0-fresh-define.md § Step 2b-2c` and follow it —
entering plan mode, then running `dev-define` inline (PHASE 0→2) to build the complete `feature.json`
draft in memory. **`defineNeeded == false`** → skip entirely, continue to Step 3.

## Step 3 — Compute the advisory `verificationProfile`

Classify each `acceptance[]` scenario as AUTO / MANUAL. **Use the short form below as the working
rule — do NOT read `test-classification.md`** here (this estimate is advisory; AGENT 2 does the
authoritative pass at verify-time). Read
`.claude/skills/dev-ship/references/dev-verify/references/test-classification.md` **only** if an item
stays genuinely ambiguous after the short form. Inputs come from the **in-memory draft** (feature.json
is not written until accept — or, on the `defineNeeded == false` branch, from the existing
`feature.json`): `requirements[].acceptance[]` (each `{ when, then, category }`), `type`, and derived
flags `hasUI` (draft has a `design` field or frontend files in `files[]`) / `isPureAPI` (has
`apiContract` and not `hasUI`).

Short form of the classifier:

- **AUTO** — pass/fail is DOM-verifiable, command-verifiable (HTTP status, stdout, exit code), or
  a programmatic a11y check. No human judgment.
- **MANUAL** — only when human perception/judgment is truly required: subjective visual quality,
  "feels fast/intuitive", real-credential auth flows, audio/screen-reader, physical multi-device.

**Pitfall-informed bias** (memory → decision). Reuse the pitfall load from `dev-define/workflow.md`
PHASE 0 §5 (it already ran, unconditionally, before the interview opened — do not re-run it here or
defer it to Step 6). If a pitfall shows a related/dependency feature **needed manual verification**
for a similar acceptance (e.g. "auth flow needed real-credential test"), lean that item toward MANUAL
even if the rules say AUTO. Note the bias in `autoDecisions`.

Add the estimate to the draft's `verificationProfile` (it rides into the plan-file appendix at Step 4b
and lands in feature.json at accept). **No checkpoint write here** — Step 3 runs inside plan mode
(when `defineNeeded`), so the profile lives only in the in-memory draft until the gate materializes
it. Shape:

```json
{ "auto": <count>, "manual": <count>, "manualTitles": ["..."], "estimatedAt": "<ISO>" }
```

> **Advisory only.** AGENT 2 (`dev-verify`) does its own authoritative classification at verify-time
> and returns the real `remainingManualItems`. This estimate is for (a) setting user expectations
> up front and (b) auto-deriving the technique plan below. PHASE 3 uses AGENT 2's output, not this.

State it in one line: `Verification profile: ~{auto} auto, ~{manual} manual → {"hands-off" | "manual walkthrough expected in PHASE 3"}`.

## Step 4 — Auto-derive the technique plan (no user prompt)

dev-ship's one human touchpoint is `define` only. The refactor/security passes are **auto-derived here
from the feature's characteristics and applied in PHASE 4** — never a pre-build menu. You cannot sensibly
pick refactor lenses or intensity before the code exists; the refactor agent decides what to apply from
the _actual_ code, test-guarded (revert-on-red), so the safe outcome is guaranteed by construction, not
by a pre-flight toggle. Draw candidates from `dev-refactor`'s lenses and the relevant OWASP categories
only — never the whole OWASP fleet.

**Signal → technique derivation** (compute into SHIP_PLAN; applied in PHASE 4, no confirmation):

| Signal in the draft                   | Derive                                                         |
| ------------------------------------- | -------------------------------------------------------------- |
| any source files to refactor          | `Reuse` (DRY), `Quality` (readability/dead-code) lenses        |
| DB access, loops/iteration, hot paths | + `Efficiency` lens                                            |
| user input + persistence/query        | OWASP **A05** (injection) — deep scanner                       |
| auth / roles / ownership checks       | OWASP **A01** (access control) — deep scanner                  |
| secrets / crypto / tokens             | OWASP **A04** (crypto) deep scanner + refactor `Security` lens |
| none of the above                     | refactor lenses only, security off                             |

> OWASP codes use **this repo's** scanner numbering (A01 access control, A04 crypto, A05 injection)
> — see the map in `references/agent-security.md`. Not the OWASP-2021 order.

**Pitfall-informed derivation** (memory → decision): if a preloaded pitfall (Step 3 load) flagged a
security issue in this feature or a **dependency** (e.g. an injection or access-control finding), add
the matching OWASP deep-scanner category even when the feature-signal heuristics alone would not —
past incidents in nearby code are a strong signal. Note it in `autoDecisions`.

### Step 4b — Plan-approval gate (only when `defineNeeded`)

Read `.claude/skills/dev-ship/references/phase-0-fresh-define.md § Step 4b` and follow it — the
go/no-go gate before build: writes the plan file, `ExitPlanMode`, and on accept writes `feature.json`

- runs the sync. **`defineNeeded == false`** → already skipped per Step 1; go straight to Step 5.

## Step 5 — Store the derived plan in memory + advance the checkpoint

Carry to the later phases (in-context; `feature.json` now exists — written at accept, or already
present on the DEFINED branch):

```
SHIP_PLAN (auto-derived — no user choice):
  feature:        {feature-name}
  refactorLenses: [Reuse, Quality, ...]      # every lens the signals warrant (Step 4 table)
  securityLight:  true | false               # true when the crypto/secrets signal fired
  securityDeep:   [A05, A01] | []            # OWASP scanners derived from signals + pitfalls
```

PHASE 4's refactor agent **always runs** (it returns `clean` when nothing meets the high-confidence,
test-guarded bar — there is no pre-build skip or intensity toggle). AGENT S runs only when `securityDeep`
is non-empty.

**Escape hatch** (optional, power-user): a `--no-refactor` or `--security {codes}` skill arg overrides
the derivation. Default is fully automatic — do not prompt.

**Persist to the checkpoint** — **patch** the minimal checkpoint that already exists from Step 2a
(SHIP-CHECKPOINT.md write point 1; use the node patcher, not a fresh heredoc). Advancing `phase` to
`"PHASE 1"` here means "plan approved, building". Set the formalized `plan` (the checkpoint's `plan`
was `{}` — no `featureDraft` was ever written, so there is nothing to null): `plan: {SHIP_PLAN +
verificationProfile}`. Persisting `SHIP_PLAN` + `verificationProfile` lets a resume skip re-deriving
them (they are auto-derived, but caching them keeps resume deterministic and cheap). Patch the changed
keys: `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`, `plan: {SHIP_PLAN + verificationProfile}`.
The `pipeline`, `feature`, `startedAt`, `baselineSha`, and empty `results`/`prompts`/`activeWorkflow`
were set at write point 0.

## Step 6 — Assemble `SHIP_CONTEXT` (the context-hub)

The main chat loads project context **once** here and feeds it to every agent, so each agent skips
its own redundant PHASE 0 bootstrap and reasons on the same context the main chat did. Build the
block from the external shared loaders (`shared/` stays external — read in place):

> **Reuse define's load — don't double-load.** If define ran inline this session (Step 2c), the main
> chat already ran `PROJECT-CONTEXT-LOAD` + `LEARNINGS-LOAD` in-context for the interview. **Reuse the
> stable dimensions** from that load (stack, endpoints, entities, structure, routing, patterns[],
> componentsCount) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define's
> hoisted PHASE 4 sync just wrote** at accept: `learnings` (define may have added some), `architecture`,
> and `feature.json#files[]` (which only exists after accept). This mirrors the "refresh mutable
> context before spawn" rule already in `SKILL.md` PHASE 2/4. **If define was skipped** (Step 1 —
> feature already ≥ DEFINED, nothing loaded in-context), do the **full** load below fresh.

The bullets below are the full-load form (used when define was skipped, and as the shape of each part):

- `node ~/.claude/scripts/context-load.js "$REPO" build` (see [shared/PROJECT-CONTEXT-LOAD.md](.claude/skills/shared/PROJECT-CONTEXT-LOAD.md)) → stack,
  endpoints, entities, structure, routing, patterns[], componentsCount. _(Reuse from Step 2c when
  define ran — stable dimensions.)_
- `shared/LEARNINGS-LOAD.md` — scopes `[component]` + `pitfall-prefix: true`, `current-feature:
{feature-name}` → the last pitfalls + component-relevant patterns (max 5). _(Mutable — re-run to
  pick up learnings define just wrote, even when define ran.)_
- Discover this feature's files via `feature.json#files[]` → a categorized `<reference-paths>` block
  (paths, **not** content — per `shared/SKILL-PATTERNS.md#pass-paths-not-content`). _(Only exists
  after define — always read here.)_

```
SHIP_CONTEXT (assembled here; each PHASE 1/2/4 agent receives its per-agent slice — see the
table below. AGENT S gets OWASP_CONTEXT instead, per agent-security.md):
  feature:     {feature-name}
  stack:       {from PROJECT-CONTEXT-LOAD build profile}
  structure:   {structure · routing · patterns[]}
  paths:       <reference-paths> from feature.json#files[]
  decisions:   SHIP_PLAN (lenses, policy, security) + verificationProfile
  learnings:   {max 5 pitfalls/patterns from LEARNINGS-LOAD}
  worktree:    {absolute path — filled after PHASE 1; empty until then}
```

Keep `SHIP_CONTEXT` in memory. The subagent-adapter (rule 5) tells each agent to use it instead of
re-running the workflow's PHASE 0 loaders.

### Per-agent slices (don't pass the whole block to everyone)

Send each agent only the slice it needs — "the right context for the task". All slices share
`feature` and `stack`; the build/verify/refactor slices all carry `worktree` — AGENT 3 runs
**pre-merge inside `worktree-{feature}`** (the finalize/merge is the main chat's PHASE 4 tail, after
refactor), so it needs the worktree path plus `finalizeRoute` (see `agent-refactor.md`). They differ
in the rest:

| Slice                        | Adds on top of the shared header                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)    | `architecture` (interfaces, registries) · `buildSequence` · `conventions` · `paths` · learnings filtered to **build** pitfalls                                      |
| **verify-slice** (AGENT 2)   | `acceptance[]` + `testStrategy` · `verificationProfile` · `paths` · learnings filtered to **test/regression** pitfalls (less architecture)                          |
| **refactor-slice** (AGENT 3) | built `files[]` · `conventions` + coding-rules scope · reuse-candidates · `SHIP_PLAN` lenses/policy · learnings filtered to **refactor** pitfalls · `finalizeRoute` |

Each agent's **pointer file** (per `agent-*.md` § Spawn) carries its own slice as the CONTEXT block;
the pointer-file **paths** travel to the agents as the **Workflow `args` payload**
(`buildPromptPath`/`verifyPromptPath` for Workflow 1, `refactorPromptPath`/`scanners`/
`triagePromptPath` for Workflow 2 — see `SKILL.md` PHASE 1+2/4). The static instruction bodies live
in `references/prompts/*` and the agents read them (plus `non-interactive-contract.md`) themselves.
Mutable-part freshness: the **verify** slice is assembled pre-build, so its prompt instructs AGENT 2
to refresh learnings/architecture/`files[]` from `.project/` itself (see `agent-verify.md`); the
**refactor** slice is rebuilt by the main chat from the post-verify `.project/` (shared into the
worktree via symlinks) just before Workflow 2 launches.
