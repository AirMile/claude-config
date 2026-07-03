# PHASE 0 — Define + Classify + Auto-derive technique plan

The one interactive phase. All human decisions are front-loaded here; everything after runs
hands-off (except the conditional manual-test interlude in PHASE 3).

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the feature, Read `.claude/skills/shared/SHIP-CHECKPOINT.md` and run its resume
detection against `.project/session/ship-{feature}.json` (use the resolved arg for `{feature}`; if
`/dev-ship` was called with no arg, first resolve the name via Step 1, then run this check):

- **Open checkpoint found** (`status != "complete"`) → present the Resume / Restart / Inspect
  `AskUserQuestion` from SHIP-CHECKPOINT.md.
  - **Resume** → run orphan/leak cleanup, load `plan` (→ `SHIP_PLAN`) + `results` from the
    checkpoint (worktree path/branch live in `results.build`), re-derive `SHIP_CONTEXT` fresh
    (Step 6), re-seed the 6-phase `TaskCreate` list (completed phases → `completed`), and **jump to
    the recorded `phase`** (skip the rest of PHASE 0). This is the credits-op / crash recovery path.
  - **Restart** → archive the old checkpoint + clean the orphan worktree, then continue PHASE 0
    fresh below.
  - **Inspect** → print checkpoint + worktree status, re-ask.
- **No open checkpoint** → run the **preflight checks** (dirty working tree, colliding
  `worktree-{feature}` from a prior aborted run without a checkpoint), surface any notice, then
  continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD`. It is written
to the checkpoint in Step 5.

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `dev-define` PHASE 0 step 1 does (arg → backlog `transition`
match → first TODO → concept → suggestions), with one dev-ship-specific addition **before** the
define-style transition match: a feature with `transition: "shipping"` (queued via the board's
⚡ Ship (auto) menu item) wins the no-arg resolution — but only on **dev-track types**: skip
entries with `type === "PAGE"` or `"COMPONENT"` (those belong to `/design-ship`; `PAGE-GAP` is
dev-track and stays here). Then check
`.project/features/{feature-name}/feature.json`:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → define already ran;
  skip to Step 3 (classify). Do not re-run define.
- **Missing / not yet DEFINED** → Step 2 (run define inline).

## Step 2 — Run `dev-define` inline (main chat, interactive)

Execute the full `dev-define` workflow by reading `.claude/skills/dev-ship/references/dev-define/workflow.md` and following
it PHASE 0 → PHASE 4 (interview, requirements, architecture, feature.json + sync). This
is the interactive part — the user answers define's questions here.

**Deviations from stock define.** Define is the one place the user is interviewed, so — unlike the
spawned agents — it runs **inline in the main chat** and the subagent-adapter is **not** applied
wholesale (define keeps `AskUserQuestion`). But these adapter-aligned deviations DO
apply, because dev-ship already owns the run:

1. **No own phase tracking** (adapter rule 1). dev-ship's 6-phase `TaskCreate` list is already
   active. Do **not** call define's own `TaskCreate`/`TaskUpdate` (its "first action of the skill:
   call TaskCreate with these 3 items") — following that would clobber dev-ship's task list. Track
   define's phases in prose instead.
2. **No terminal handoff** (adapter rule 4). Skip define's Next-Step Clipboard Offer
   (`NEXT-STEP-OFFER.md`) and its `Next: /dev-build` / clipboard output. dev-ship continues to Step 3
   itself.
3. **No plan mode** (adapter rule 2). **Never** call `EnterPlanMode`/`ExitPlanMode` — run define's
   PHASE 0→2 analytical/interview steps directly, in the main chat. Ignore every "plan mode must be
   active before …" / "Enter Plan Mode NOW" / "Exit plan mode" instruction in the copied define
   workflow. `/dev-ship` must **never** surface a plan-mode screen or a plan-approval gate. Two
   define behaviours that plan mode used to carry are preserved without it: **(a) write-gating** —
   all `.project/{backlog,project,project-context}.json` writes still wait until PHASE 4's sync
   batch (do not write them early just because the plan-mode block is gone); **(b) the machine
   contract** (type signatures, `buildSequence`, `testStrategy`) is authored **in-context** during
   define's PHASE 2 and transcribed straight into `feature.json` at PHASE 3 — take define's existing
   "appendix missing → generate these sections now" fallback path (there is no plan file to write
   the appendix to). No plan file is created.
4. **Spec preview STAYS** (this is the one place define's HTML preview runs — define is inline in the
   main chat, so the browser is reachable here; adapter rule 8's "no browser" applies only to the
   spawned subagents). Instead of define PHASE 4's wireframe-only preview, dev-ship renders an
   **adaptive feature-spec preview** so the user sees what is about to be built before the hands-off
   pipeline starts (it visually replaces the plan-approval gate removed in deviation 3). See Step 2c.
5. **Backlog write STAYS** (adapter rule 13). Define still flips `feature.json` + `backlog.json` to
   `status: "DEFINED"` — PHASE 1's build reads DEFINED, so this transition is required, not dead. The
   `auto: true` flag is harmless (ignore its now-moot "so the clipboard has the correct `/dev-build`
   command" rationale — there is no clipboard step here).
6. When define finishes the DEFINED write, continue to Step 2c (preview) then Step 3 — do not end the
   skill.

**Kept as-is** (define is NOT a silent subagent): `AskUserQuestion` reaches the real user (the whole
reason define is the main-chat touchpoint), and define's interview + write-gating discipline run as
normal — just **without** the plan-mode wrapper and the `ExitPlanMode` approval gate (deviation 3).
Everything else in define runs unchanged (it owns its own `.project/` writes).

## Step 2b — Board state: `shipping` marker + live signal

The backlog board renders two progress states: **queued** (`transition` set by a board copy
action) and **live** (`.project/session/active-{feature}.json`, pulsing badge). dev-ship owns both
for the whole run:

1. **Live signal** — if define was skipped (Step 1: already ≥ DEFINED), write it now; when define
   ran inline it already wrote and cleaned its own signal, so re-arm it here either way:

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO}"}' > .project/session/active-{feature-name}.json
   ```

   The later SKILL.md phase boundaries rewrite this same file with `skill: build | verify |
refactor` — the board badge follows the pipeline.

2. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry (define's
   phase4-sync removes any transition; re-set it after define completes). This keeps the card in
   the board's IN PROGRESS section between phases, when no agent is running. It is removed by
   refactor's completion-batch (feature shipped) or by PHASE 5 cleanup on every other exit path.

## Step 2c — Present the feature-spec preview (main chat, auto-open browser)

dev-ship is hands-off after this phase and (per Step 2 deviation 3) shows no plan-approval gate — so
give the user one visual confirmation of **what is about to be built** before the pipeline runs
autonomously. This runs in the main chat (browser reachable) and is **non-blocking**: a launch
failure prints the path, never halts. Skip entirely (no error) if the resolved `feature.json` has no
`requirements[]` yet (should not happen post-define).

Assemble the `preview-data` payload from the just-written `feature.json` (adaptive — include only
the fields that exist):

```
{
  "feature":       "{feature-name}",
  "type":          feature.type,
  "status":        "DEFINED",
  "requirements":  feature.requirements[] → [{ id, text }],
  "acceptance":    flattened requirements[].acceptance[] → [{ when, then }],
  "wireframe":     feature.design (ASCII sketch) — omit when absent,
  "apiContract":   feature.apiContract endpoints → [{ method, path, req, resp }] — omit when absent,
  "buildSequence": feature.architecture.buildSequence[] → [{ step, dependsOn }] — omit when absent
}
```

> **Todo**: render `.claude/skills/shared/references/preview-feature-spec.html` to
> `.project/previews/dev-ship-{feature-name}.html` (fill the `preview-data` JSON block with the
> payload above), then present that `file://` path via `.claude/skills/shared/HTML-PRESENT.md`
> (auto-opens in the browser; `CLAUDE_AUTO_PREVIEW=0` opts out). One preview per run. The textual
> "Verification profile" line (Step 3) still prints — the preview is the visual layer on top, not a
> replacement.

## Step 3 — Compute the advisory `verificationProfile`

Classify each `acceptance[]` scenario as AUTO / MANUAL using the **canonical rules** in
`.claude/skills/dev-ship/references/dev-verify/references/test-classification.md` (single source of truth). Inputs are
already on disk after define: `feature.json#requirements[].acceptance[]` (each `{ when, then,
category }`), `feature.type`, and derived flags `hasUI` (feature has a `design` field or frontend
files in `files[]`) / `isPureAPI` (has `apiContract` and not `hasUI`).

Short form of the classifier (defer to test-classification.md for edge cases):

- **AUTO** — pass/fail is DOM-verifiable, command-verifiable (HTTP status, stdout, exit code), or
  a programmatic a11y check. No human judgment.
- **MANUAL** — only when human perception/judgment is truly required: subjective visual quality,
  "feels fast/intuitive", real-credential auth flows, audio/screen-reader, physical multi-device.

**Pitfall-informed bias** (memory → decision). Load preloaded pitfalls now via
`shared/LEARNINGS-LOAD.md` (scopes `[component]` + pitfall-prefix, including **direct dependencies**)
— this same load feeds Step 6, so do it once here. If a pitfall shows a related/dependency feature
**needed manual verification** for a similar acceptance (e.g. "auth flow needed real-credential
test"), lean that item toward MANUAL even if the rules say AUTO. Note the bias in `autoDecisions`.

Write the estimate to `feature.json#verificationProfile`:

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

| Signal in feature.json                | Derive                                                         |
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

## Step 5 — Store the derived plan in memory

Carry to the later phases (in-context, no extra `.project/` write beyond `verificationProfile`):

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

**Persist to the checkpoint** (the first write, per `shared/SHIP-CHECKPOINT.md` atomic-write). This
makes the run resumable — persisting `SHIP_PLAN` + `verificationProfile` lets a resume skip re-deriving
them (they are auto-derived, but caching them keeps resume deterministic and cheap). Write
`.project/session/ship-{feature}.json` with `pipeline: "dev"`, `feature`,
`startedAt`/`updatedAt`, `status: "running"`, `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`,
`baselineSha` (from Step 0), `plan: {SHIP_PLAN + verificationProfile}`, empty `results`/`prompts`,
`activeWorkflow: null`.

## Step 6 — Assemble `SHIP_CONTEXT` (the context-hub)

The main chat loads project context **once** here and feeds it to every agent, so each agent skips
its own redundant PHASE 0 bootstrap and reasons on the same context the main chat did. Build the
block from the external shared loaders (`shared/` stays external — read in place):

> **Reuse define's load — don't double-load.** If define ran inline this session (Step 2), the main
> chat already ran `PROJECT-CONTEXT-LOAD` + `LEARNINGS-LOAD` in-context for the interview. **Reuse the
> stable dimensions** from that load (stack, endpoints, entities, structure, routing, patterns[],
> componentsCount) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define
> itself just wrote** in its PHASE 4 sync: `learnings` (define may have added some), `architecture`,
> and `feature.json#files[]` (which only exists after define). This mirrors the "refresh mutable
> context before spawn" rule already in `SKILL.md` PHASE 2/4. **If define was skipped** (Step 1 —
> feature already ≥ DEFINED, nothing loaded in-context), do the **full** load below fresh.

The bullets below are the full-load form (used when define was skipped, and as the shape of each part):

- `shared/PROJECT-CONTEXT-LOAD.md` — run the **build** profile (`FEAT="{feature-name}"`) → stack,
  endpoints, entities, structure, routing, patterns[], componentsCount. _(Reuse from Step 2 when
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
`feature` and `stack`; the build/verify slices also carry `worktree`, but the **refactor slice does
not** — AGENT 3 runs on `main` after PHASE 3 finalize removed the worktree (leave `worktree` empty
there). They differ in the rest:

| Slice                        | Adds on top of the shared header                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)    | `architecture` (interfaces, registries) · `buildSequence` · `conventions` · `paths` · learnings filtered to **build** pitfalls                    |
| **verify-slice** (AGENT 2)   | `acceptance[]` + `testStrategy` · `verificationProfile` · `paths` · learnings filtered to **test/regression** pitfalls (less architecture)        |
| **refactor-slice** (AGENT 3) | built `files[]` · `conventions` + coding-rules scope · reuse-candidates · `SHIP_PLAN` lenses/policy · learnings filtered to **refactor** pitfalls |

Each agent's **pointer file** (per `agent-*.md` § Spawn) carries its own slice as the CONTEXT block;
the pointer-file **paths** travel to the agents as the **Workflow `args` payload**
(`buildPromptPath`/`verifyPromptPath` for Workflow 1, `refactorPromptPath`/`scanners`/
`triagePromptPath` for Workflow 2 — see `SKILL.md` PHASE 1+2/4). The static instruction bodies live
in `references/prompts/*` and the agents read them (plus `non-interactive-contract.md`) themselves.
Mutable-part freshness: the **verify** slice is assembled pre-build, so its prompt instructs AGENT 2
to refresh learnings/architecture/`files[]` from `.project/` itself (see `agent-verify.md`); the
**refactor** slice is rebuilt by the main chat from the post-merge `.project/` just before Workflow 2
launches.
