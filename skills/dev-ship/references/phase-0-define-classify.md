# PHASE 0 — Define + Classify + Technique menu

The one interactive phase. All human decisions are front-loaded here; everything after runs
hands-off (except the conditional manual-test interlude in PHASE 3).

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `dev-define` PHASE 0 step 1 does (arg → backlog `transition`
match → first TODO → concept → suggestions). Then check `.project/features/{feature-name}/feature.json`:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → define already ran;
  skip to Step 3 (classify). Do not re-run define.
- **Missing / not yet DEFINED** → Step 2 (run define inline).

## Step 2 — Run `dev-define` inline (main chat, interactive)

Execute the full `dev-define` workflow by reading `.claude/skills/dev-ship/references/dev-define/workflow.md` and following
it PHASE 0 → PHASE 4 (plan mode, interview, requirements, architecture, feature.json + sync). This
is the interactive part — the user answers define's questions here.

**Deviations from stock define.** Define is the one place the user is interviewed, so — unlike the
spawned agents — it runs **inline in the main chat** and the subagent-adapter is **not** applied
wholesale (define keeps plan mode and `AskUserQuestion`). But these adapter-aligned deviations DO
apply, because dev-ship already owns the run:

1. **No own phase tracking** (adapter rule 1). dev-ship's 6-phase `TaskCreate` list is already
   active. Do **not** call define's own `TaskCreate`/`TaskUpdate` (its "first action of the skill:
   call TaskCreate with these 3 items") — following that would clobber dev-ship's task list. Track
   define's phases in prose instead.
2. **No terminal handoff** (adapter rule 4). Skip define's Next-Step Clipboard Offer
   (`NEXT-STEP-OFFER.md`) and its `Next: /dev-build` / clipboard output. dev-ship continues to Step 3
   itself.
3. **No HTML preview** (adapter rule 8). Skip define PHASE 4's preview generation (`HTML-PRESENT.md`)
   — dev-ship proceeds straight to build; the user reviews the feature via the technique menu, not a
   mid-flow browser tab.
4. **Backlog write STAYS** (adapter rule 13). Define still flips `feature.json` + `backlog.json` to
   `status: "DEFINED"` — PHASE 1's build reads DEFINED, so this transition is required, not dead. The
   `auto: true` flag is harmless (ignore its now-moot "so the clipboard has the correct `/dev-build`
   command" rationale — there is no clipboard step here).
5. When define finishes the DEFINED write, continue to Step 3 — do not end the skill.

**Kept as-is** (define is NOT a silent subagent): plan mode routes the interview and gates writes to
PHASE 4 as normal; `AskUserQuestion` reaches the real user (the whole reason define is the main-chat
touchpoint). Everything else in define runs unchanged (it owns its own `.project/` writes).

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
> up front and (b) auto-suggesting the technique menu below. PHASE 3 uses AGENT 2's output, not this.

State it in one line: `Verification profile: ~{auto} auto, ~{manual} manual → {"hands-off" | "manual walkthrough expected in PHASE 3"}`.

## Step 4 — Present the technique menu (auto-suggested)

Suggest techniques from the feature's characteristics. Draw candidates from `dev-refactor`'s lenses
and the relevant OWASP categories only — never the whole OWASP fleet.

**Auto-suggest heuristics** (pre-check the boxes the feature warrants):

| Signal in feature.json                | Suggest                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| any source files to refactor          | `Reuse` (DRY), `Quality` (readability/dead-code) lenses  |
| DB access, loops/iteration, hot paths | `Efficiency` lens                                        |
| user input + persistence/query        | OWASP **A05** (injection) — deep audit                   |
| auth / roles / ownership checks       | OWASP **A01** (access control) — deep audit              |
| secrets / crypto / tokens             | OWASP **A04** (crypto) deep, or refactor `Security` lens |
| none of the above                     | refactor lenses only, security off                       |

> OWASP codes use **this repo's** scanner numbering (A01 access control, A04 crypto, A05 injection)
> — see the map in `references/agent-security.md`. Not the OWASP-2021 order.

**Pitfall-informed pre-check** (memory → decision): if a preloaded pitfall (Step 3 load) flagged a
security issue in this feature or a **dependency** (e.g. an injection or access-control finding),
pre-check the matching OWASP deep-audit category even when the feature-signal heuristics alone would
not — past incidents in nearby code are a strong signal.

Present via `AskUserQuestion` (multiSelect) — the pre-suggested items first, plus policy:

```yaml
header: "Ship techniques"
question: "Which quality/security passes for {feature}? (pre-checked = suggested)"
options:
  - label: "Refactor: Reuse + Quality (Recommended)"
    description: "DRY/dead-code/readability lenses via dev-refactor, test-guarded"
  - label: "Refactor: Efficiency"
    description: "N+1, hot-path, concurrency — suggested for DB/loop-heavy features"
  - label: "Security: light (refactor lens)"
    description: "Secrets/crypto/input-flow via dev-refactor's Security lens, fixes with tests"
  - label: "Security: deep OWASP audit ({categories})"
    description: "Targeted owasp-aNN scanner(s), reports findings only (no auto-fix)"
multiSelect: true
```

Then policy (single-select):

```yaml
header: "Refactor policy"
question: "Refactor intensity for the auto pass?"
options:
  - label: "Conservative (Recommended)"
    description: "Only high-confidence techniques — test-guard reverts the rest"
  - label: "Aggressive"
    description: "Apply broader technique set; still test-guarded"
  - label: "Skip refactor"
    description: "No auto-refactor — leave it to a later batch /dev-refactor"
multiSelect: false
```

## Step 5 — Store selections in memory

Carry to the later phases (in-context, no extra `.project/` write beyond `verificationProfile`):

```
SHIP_PLAN:
  feature:        {feature-name}
  refactorLenses: [Reuse, Quality, ...]      # or [] if "Skip refactor"
  refactorPolicy: conservative | aggressive | skip
  securityLight:  true | false               # refactor Security lens
  securityDeep:   [A03, A01] | []            # targeted OWASP scanners for AGENT S
```

`refactorPolicy: skip` → PHASE 4 skips AGENT 3 (only AGENT S may still run if `securityDeep`).

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
SHIP_CONTEXT (assembled here, passed verbatim into every AGENT prompt):
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
`feature`, `stack`, `worktree`; they differ in the rest:

| Slice                        | Adds on top of the shared header                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)    | `architecture` (interfaces, registries) · `buildSequence` · `conventions` · `paths` · learnings filtered to **build** pitfalls                    |
| **verify-slice** (AGENT 2)   | `acceptance[]` + `testStrategy` · `verificationProfile` · `paths` · learnings filtered to **test/regression** pitfalls (less architecture)        |
| **refactor-slice** (AGENT 3) | built `files[]` · `conventions` + coding-rules scope · reuse-candidates · `SHIP_PLAN` lenses/policy · learnings filtered to **refactor** pitfalls |

Each `agent-*.md` pastes its own slice into the `{paste the SHIP_CONTEXT block …}` placeholder. The
main chat also **refreshes the mutable parts** (learnings, architecture) from `.project/` before each
spawn — see `SKILL.md` PHASE 1/2/4 — so verify and refactor never get a stale PHASE 0 snapshot.
