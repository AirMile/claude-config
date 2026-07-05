# PHASE 0 — Define + Classify + Auto-derive technique plan

The one interactive phase. All human decisions are front-loaded here; everything after runs
hands-off (except the conditional manual-test interlude in PHASE 3).

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the feature, Read `.claude/skills/shared/SHIP-CHECKPOINT.md` and run its resume
detection against `.project/session/ship-{feature}.json` (use the resolved arg for `{feature}`; if
`/dev-ship` was called with no arg, first resolve the name via Step 1, then run this check):

- **Open checkpoint found** (`status != "complete"`) → apply SHIP-CHECKPOINT.md's resume logic:
  - **Direct resume (fast path)** — when `/dev-ship` was called with an **explicit** feature arg AND
    `pipeline: "dev"` AND `status: "running"` AND `updatedAt` ≤ 24h: **no question**. Announce
    `Resuming {feature} at {phase} — checkpoint {age} old`, run orphan/leak cleanup, load `plan`
    (→ `SHIP_PLAN`) + `results`, re-derive `SHIP_CONTEXT` (Step 6), re-seed the 6-phase `TaskCreate`
    list (completed → `completed`), and jump to the recorded `phase`:
    - `phase: "PHASE 3"` (interactive) → re-enter per `phase-3-manual-finalize.md § Resume entry`
      (worktree entry + app launch, then the walkthrough over `results.verify.remainingManualItems`).
    - `phase: "PHASE 0 · plan gate"` → jump to **Step 4b**, restoring the `featureDraft` from the
      checkpoint's `plan` (re-run Step 3 + Step 4 first only if they were never applied to the draft).
    - a workflow phase (`PHASE 1/2/4`) → relaunch per SHIP-CHECKPOINT.md § On "Resume" step 4.
  - **Edge cases** (no explicit arg, `status: "failed"`, or `updatedAt` > 24h) → present the Resume /
    Restart / Inspect `AskUserQuestion` from SHIP-CHECKPOINT.md:
    - **Resume** → same load + jump as the fast path above.
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

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → the plan gate was
  **already accepted in a prior run**. `feature.json` is written only at gate-accept now (Step 4b), so
  its presence unambiguously means "past the gate." Skip both define **and** the gate: go to Step 3
  (re-derive the plan — classify + technique are deterministic from `feature.json`) → build. This is
  the resume-recovery path for the narrow window where a prior run accepted the gate but stopped
  before the light checkpoint advanced past it. (Once the checkpoint exists — the usual case — Step 0's
  direct resume catches it first.)
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
3. **Define's own plan-mode wrapper is stripped; its writes are hoisted to the gate** (adapter rule
   2). **Never** call `EnterPlanMode`/`ExitPlanMode` _inside_ define's PHASE 0→2 analytical/interview
   steps — run them directly, in the main chat. Ignore every "plan mode must be active before …" /
   "Enter Plan Mode NOW" / "Exit plan mode" instruction in the copied define workflow. The interview
   stays inline so `AskUserQuestion` keeps reaching the real user (define is **not** "auto" — that word
   describes the hands-off build/verify/refactor phases, never define).

   In auto-mode, define runs **only its PHASE 0→2** here: the interview, architecture, and authoring
   the **complete feature.json draft** (requirements + acceptance, `files`, `architecture`,
   `buildSequence`, `testStrategy`, conditional fields). That draft is held **in memory** — do **not**
   write `feature.json`, and do **not** run define's PHASE 3 (write) or PHASE 4 (sync) yet. Define's
   PHASE 3+4 are **hoisted to gate-accept** (Step 4b): on Accept the draft becomes the plan-file
   appendix, `feature-from-plan.js` writes `feature.json` from it, and define's PHASE 4 sync runs. So
   the whole run goes through the same plan-file + appendix + accept flow as stock define — the
   approved plan **is** the contract, and no `feature.json` exists before you accept. Two define
   behaviours plan mode used to carry are preserved without it: **(a) write-gating** — all
   `.project/{backlog,project,project-context}.json` writes wait until the accept-time sync (Step 4b),
   not PHASE 4; **(b) the machine contract** is authored in-context during PHASE 2 exactly as above,
   just held as a draft rather than written.

   **The single plan-approval gate** is dev-ship's own consolidated `EnterPlanMode` → `ExitPlanMode`
   at the very **end** of PHASE 0 (Step 4b), after define + classify + technique derivation — one
   review surface for the whole feature plan before the hands-off pipeline starts (the Step 2c preview
   is only a visual aid on top, shown when there is UI). See Step 4b.

4. **Spec preview is conditional — visual aid only** (this is the one place define's HTML preview
   can run — define is inline in the main chat, so the browser is reachable here; adapter rule 8's
   "no browser" applies only to the spawned subagents). Instead of define PHASE 4's wireframe-only
   preview, dev-ship renders an **adaptive feature-spec preview** — but **only when the feature has
   genuine visual UI to show** (a `design`/wireframe field or a `hasUI` feature). It is a visual layer
   on top of the Step 4b plan-approval gate, **not** a replacement for it: the gate is the review
   surface, the preview just helps the user see the UI. For a pure-logic/API feature there is nothing
   visual to render, so the preview is skipped entirely (no error). See Step 2c.
5. **Backlog DEFINED flip moves to accept** (adapter rule 13). Define does **not** flip `feature.json`
   - `backlog.json` to `status: "DEFINED"` during Step 2 — that flip is part of define's hoisted
     PHASE 3+4 and happens at **gate-accept** (Step 4b), alongside `feature.json` being written. PHASE 1's
     build reads DEFINED, so the transition is still required — just deferred until after you accept. The
     `auto: true` flag is set with it (ignore its now-moot clipboard rationale — there is no clipboard
     step here). Benefit: a rejected-and-abandoned define leaves **no** orphan `DEFINED` card with no
     build behind it.
6. After define finishes authoring the draft (PHASE 0→2), **write the light checkpoint now**
   (SHIP-CHECKPOINT.md write point 0): `.project/session/ship-{feature}.json` with `pipeline: "dev"`,
   `feature`, `startedAt`/`updatedAt`, `status: "running"`, `phase: "PHASE 0 · plan gate"`,
   `completedPhases: []`, `baselineSha` (from Step 0), empty `results`/`prompts`,
   `activeWorkflow: null`, and `plan: { featureDraft: <the in-memory draft> }`. The `featureDraft` is
   the **durable pre-accept home** for the draft (no `feature.json` exists yet) — it makes the gate
   resumable from a fresh session without re-running the interview (same pattern design uses for its
   deferred spec; see SHIP-CHECKPOINT.md). This is the last write slot before the plan gate (plan mode
   blocks `.project/` writes) and the board shows it parked. Then continue to Step 2c (preview) then
   Step 3 — do not end the skill.

**Kept as-is** (define is NOT a silent subagent): `AskUserQuestion` reaches the real user (the whole
reason define is the main-chat touchpoint), and define's interview + write-gating discipline run as
normal — just **without** the plan-mode wrapper and with its PHASE 3+4 hoisted to gate-accept
(deviation 3). Everything else in define's PHASE 0→2 runs unchanged.

## Step 2b — Board state: `shipping` marker + live signal

The backlog board renders two progress states: **queued** (`transition` set by a board copy
action) and **live** (`.project/session/active-{feature}.json`, pulsing badge). dev-ship owns both
for the whole run:

1. **Live signal** — write (or re-arm) it now, whether define was skipped (Step 1: already ≥ DEFINED)
   or ran inline (its PHASE 4 signal-cleanup is hoisted to accept, so re-arm here either way):

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO}"}' > .project/session/active-{feature-name}.json
   ```

   The later SKILL.md phase boundaries rewrite this same file with `skill: build | verify |
refactor` — the board badge follows the pipeline.

2. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry. This keeps
   the card in the board's IN PROGRESS section between phases, when no agent is running. (Define's
   PHASE 4 sync, which would clear the transition, is hoisted to accept; Step 4b re-sets `shipping`
   after that sync runs.) It is removed by refactor's completion-batch (feature shipped) or by PHASE 5
   cleanup on every other exit path.

## Step 2c — Present the feature-spec preview (conditional: only when there is visual UI)

The plan-approval gate (Step 4b) is the review surface; this preview is **only a visual aid** for
features that actually have UI to show. **Condition — render the preview only when** the feature has
a `design`/wireframe field **or** `hasUI` is true (a `design` field or frontend files in `files[]`).
For a pure-logic/API feature there is nothing visual, so **skip the preview entirely** (no error) —
this is expected, not a deviation. Also skip if the in-memory draft has no `requirements[]` yet
(should not happen post-define).

When it does run: it is in the main chat (browser reachable) and **non-blocking** — a launch failure
prints the path, never halts; `CLAUDE_AUTO_PREVIEW=0` opts out. It renders **before** the Step 4b
gate so the user can see the UI while approving the plan. The Step 3 "Verification profile" line
still prints regardless.

Assemble the `preview-data` payload from the in-memory feature draft (adaptive — include only
the fields that exist; `feature.*` below refers to that draft, not a file on disk):

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

> **Todo** (only when the UI condition above holds): render
> `.claude/skills/shared/references/preview-feature-spec.html` to
> `.project/previews/dev-ship-{feature-name}.html` (fill the `preview-data` JSON block with the
> payload above), then present that `file://` path via `.claude/skills/shared/HTML-PRESENT.md`
> (auto-opens in the browser; `CLAUDE_AUTO_PREVIEW=0` opts out). One preview per run. The textual
> "Verification profile" line (Step 3) still prints — the preview is the visual layer on top, not a
> replacement.
>
> **Skip clause**: when the feature's ASCII wireframe already rides inside the Step 4b plan gate
> (the gate presents the `design` sketch), the standalone HTML preview is redundant — skip it (no
> browser side-trip). The gate is the review surface; render the HTML only when there is richer UI
> to show than the gate's inline sketch. Skipping is expected, not a deviation.

## Step 3 — Compute the advisory `verificationProfile`

Classify each `acceptance[]` scenario as AUTO / MANUAL using the **canonical rules** in
`.claude/skills/dev-ship/references/dev-verify/references/test-classification.md` (single source of truth). Inputs come
from the **in-memory draft** (feature.json is not written until accept): `requirements[].acceptance[]`
(each `{ when, then, category }`), `type`, and derived flags `hasUI` (draft has a `design` field or
frontend files in `files[]`) / `isPureAPI` (has `apiContract` and not `hasUI`).

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

Add the estimate to the draft's `verificationProfile` (it rides into the plan-file appendix at Step 4b
and lands in feature.json at accept; feature.json is not written here). Also patch it into the light
checkpoint's `plan.featureDraft.verificationProfile` so a resume-at-gate keeps it:

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

## Step 4b — Plan-approval gate (plan mode) — the go/no-go before build

The single human go/no-go for the whole run, and the point where `feature.json` is **written** — not
before. Define authored the complete draft (in memory, stashed in the checkpoint's
`plan.featureDraft`), Step 3 added `verificationProfile`, Step 4 derived the technique plan. Now the
draft becomes the plan-file appendix, the user **accepts**, and only then does the extract write
`feature.json`. This is dev-ship's own consolidated gate — one review surface for the whole plan. It
always runs (no env-var opt-out): the whole PHASE 0 is main-chat interactive anyway, so the gate adds
no new blocker a headless run wouldn't already hit at the define interview.

**Ordering — why the gate is here.** It runs **after** Step 2c's optional preview (so the user can
see the UI while approving) and after classify + technique derivation (so the plan is complete). No
`feature.json` / backlog / project writes have happened yet — they are all deferred to Accept below,
so entering plan mode now blocks nothing that was going to run before it.

**Steps:**

1. **Signal the board is waiting, and ensure the light checkpoint exists.** Do both **before**
   `EnterPlanMode` — writes are blocked once in plan mode.
   - Rewrite the live signal with a `waiting` field so the board shows the run paused for input (per
     `shared/DEVINFO.md`): rewrite `.project/session/active-{feature}.json` adding
     `"waiting": "plan-review"`.
   - **Light checkpoint:** it normally already exists (Step 2 deviation 6 wrote it with
     `plan.featureDraft`). Only if it does **not** exist yet — the resume-recovery case where Step 1's
     DEFINED branch fired (a prior run already accepted, `feature.json` on disk) — reconstruct the
     draft from `feature.json` and write the checkpoint now (SHIP-CHECKPOINT.md write point 0). If it
     already exists, just touch `updatedAt`. Either way the gate is resumable.
2. **`EnterPlanMode`.** You receive the plan-file path via system-reminder.
3. **Write the plan file** — two parts, per `dev-define/workflow.md` PHASE 2 (same shape as stock
   define):
   - **Review surface** — a concise, readable summary: feature name + type + one-line intent;
     `requirements[]` with their `acceptance[]` scenarios (`when → then`); architecture /
     `buildSequence` + key interfaces; the Step 3 "Verification profile" line (~N auto, ~N manual);
     the auto-derived technique plan (`refactorLenses`, `securityDeep` scanners, or "security off");
     a closing line: "Accept → build starts (PHASE 1). Reject → back to the define interview to
     revise."
   - **`## Appendix — machine contract (skip review)`** — the complete `featureDraft` (incl.
     `verificationProfile`) as a single ```json block. This is what the extract reads on Accept.
4. **`ExitPlanMode`** to present it for approval.
   - **Accept** → run define's hoisted PHASE 3+4 now: (a)
     `node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature}/feature.json`
     writes `feature.json` from the appendix; (b) run define's PHASE 4 sync (backlog `status: "DEFINED"`
     with `auto: true`, plus project.json and project-context.json — per
     `dev-define/references/phase4-sync.md`; for Tauri/desktop projects the project.json **endpoint**
     sync no-ops — `invoke` commands are not REST endpoints, so that array stays empty and only
     project-context components update), and re-set `transition: "shipping"` (Step 2b); (c) rewrite
     `active-{feature}.json` **without** the `waiting` field. Then continue to Step 5 (checkpoint patch)
     → Step 6 → build.
   - **Reject** → return to the define interview to revise: re-run **Step 2** (`dev-define` inline)
     from the in-memory draft (still no `feature.json` on disk) — the user restates/adjusts
     requirements + architecture and define re-authors the draft. Then re-run Step 3 (reclassify),
     Step 4 (re-derive), and re-present this gate. Loop until accepted (mirrors `dev-debug`'s "plan
     rejection lets the user revise" pattern).

**Resume note.** The **light checkpoint** at this gate (`phase: "PHASE 0 · plan gate"`, written in
Step 2 deviation 6) holds the `featureDraft`. If the session ends while the gate is open, a
fresh-session `/dev-ship {feature}` direct-resumes it (Step 0 fast path) straight back to this gate —
restoring the draft from `plan.featureDraft` and re-writing the appendix, **no interview re-run**
(`feature.json` does not exist yet, so there is nothing to reconstruct from disk). Step 1's DEFINED
branch is the separate path for a prior run that already **accepted**. The board shows the feature
parked (`plan approval pending`) the whole time.

## Step 5 — Store the derived plan in memory

Carry to the later phases (in-context; `feature.json` was just written at accept):

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

**Persist to the checkpoint** — **patch** the light checkpoint that already exists from Step 2
(SHIP-CHECKPOINT.md write point 1; use the node patcher, not a fresh heredoc). This runs **only after
the Step 4b gate is accepted** — advancing `phase` to `"PHASE 1"` here means "plan approved,
building". Replace the pre-accept `plan.featureDraft` with the formalized `plan`: now that
`feature.json` is on disk (written at accept), the draft is no longer the durable home. Persisting
`SHIP_PLAN` + `verificationProfile` lets a resume skip re-deriving them (they are auto-derived, but
caching them keeps resume deterministic and cheap). Patch the changed keys: `phase: "PHASE 1"`,
`completedPhases: ["PHASE 0"]`, `plan: {SHIP_PLAN + verificationProfile, "featureDraft": null}` — the
explicit `featureDraft: null` drops it (the patcher deep-merges `plan`, so it must be nulled, not just
omitted). The `pipeline`, `feature`, `startedAt`, `baselineSha`, and empty
`results`/`prompts`/`activeWorkflow` were set at write point 0.

## Step 6 — Assemble `SHIP_CONTEXT` (the context-hub)

The main chat loads project context **once** here and feeds it to every agent, so each agent skips
its own redundant PHASE 0 bootstrap and reasons on the same context the main chat did. Build the
block from the external shared loaders (`shared/` stays external — read in place):

> **Reuse define's load — don't double-load.** If define ran inline this session (Step 2), the main
> chat already ran `PROJECT-CONTEXT-LOAD` + `LEARNINGS-LOAD` in-context for the interview. **Reuse the
> stable dimensions** from that load (stack, endpoints, entities, structure, routing, patterns[],
> componentsCount) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define's
> hoisted PHASE 4 sync just wrote** at accept: `learnings` (define may have added some), `architecture`,
> and `feature.json#files[]` (which only exists after accept). This mirrors the "refresh mutable
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
