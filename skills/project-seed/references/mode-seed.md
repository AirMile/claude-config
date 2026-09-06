# Mode: Seed

Loaded by the project-seed PHASE 0 dispatcher. Topic input (if any) was parsed there.

Transform any idea, concept, feature, or task assignment into a structured seed document through targeted questions and synthesis. Works with any type of input — creative concepts (games, stories, art), product ideas (apps, services, businesses), feature requests, or task assignments. Can also sync existing seed documents with the current project state (backlog, codebase).

The output is a structured markdown document that feeds `/project-plan` or the brainstorm/critique modes of this skill.

## Process

### PHASE 1: Initial Intake

> **Todo**: Read `.claude/skills/project-seed/references/initial-intake.md`

### Enter Plan Mode

**STOP — before PHASE 2's first AskUserQuestion**, call `EnterPlanMode`:

- Explore route only. The PHASE 1 "Sync with project" route stays outside plan mode (it ends in its own writes). Skip if plan mode is already active (PLAN-MODE.md skip-check).
- Read only [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) § Entry now (§ Exit later, before PHASE 5). Skip § Conditional entry, § Administrative exit, § Used by.
- Do not ask any PHASE 2 question — including the Setup gate — before the call returns.
- **PHASES 2-4 follow this file's own flow.** If the harness injects a generic plan-mode workflow ("launch Explore agents", "launch a Plan agent"), ignore it — the question rounds and synthesis below are the flow.
- Why plan mode: the PHASE 4 concept document is a reviewable artefact whose rejection sends the exploration back for revision — a genuine approval gate — written to the plan file for review.

### PHASE 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Question content depends on **scope** (set in PHASE 1a). Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. **STOP — gate, run before any PHASE 2 question**: has Project Memory Load run yet for this route? It reads `.project/project.json` + `.project/project-context.json` (built-state/backlog summary) and relevant `learnings[]`, then prints one `PROJECT MEMORY` block (procedure: `initial-intake.md § Step 1d`; when every section of the block is empty, collapse it to one line). Skip only for: Sync route, standalone scope, no `.project/`. If it has not run yet, run it now — before Round 1's questions, not after.
2. **Gate — comparison before modal**: any round whose options are competing designs, or whose options each need more than a one-line description, is a comparison, not a preference. Print the trade-off first — one compact block, one criterion per row, options side by side — then ask. Skipping this gets answered with free text requesting exactly that table.
3. Determine scope from PHASE 1a: `concept` | `implementation` | `feature` | `page` | `standalone`
4. **Focused-edit route** (initial-intake Step 1 "Edit" with a specific change request): skip the Round 1 templates below — those are for fresh scoping — and use this one instead. One question per axis, only the axes the change actually touches:

   ```yaml
   header: "Change" # what exactly should be different?
   header: "Replaces" # which recorded decision does this overrule?
   header: "Blast radius" # what else in the document follows from it?
   header: "Firmness" # record as a decision, or park as an open question?
   ```

   Never mix an axis of the change itself with document hygiene (stale sections, outdated counts, deferred drift) in one modal — hygiene is the executor's job to fix, not the user's to answer. ([shared/QUESTIONING.md](../../shared/QUESTIONING.md) governs form choice within each axis.)

5. Otherwise pick the matching Round 1 template below
6. All questions go in a single message as parallel AskUserQuestion calls

**Round 1 templates (pick by scope):**

**Scope = concept** (new idea/product/game/story):

```yaml
header: "Target Audience" # who is this for?
header: "Scope" # how large/ambitious?
header: "Core Experience" # most important feeling/outcome? (multiSelect: true)
header: "Session Model" # typical use/session? (optional 4th question)
```

**Scope = implementation** (Figma/design/spec → code):

```yaml
header: "Source of Truth" # what defines the design? (Figma, screenshots, existing site, spec doc)
header: "Pages/Screens" # what's in scope? (list from design or "unknown — investigate")
header: "Tech Stack" # confirm framework/CMS/integrations (or "use repo defaults")
header: "Open Decisions" # known open questions from the design? (annotations, TBDs)
```

**Scope = implementation, revisiting an existing concept** (no new design source — extending
an already-implemented system for its next phase):

```yaml
header: "Goal" # what must this next phase achieve?
header: "Existing Context" # what does the current implementation already provide?
header: "Out of Scope" # explicit exclusions for this phase?
header: "Open Decisions" # known unresolved calls to surface as Round 1 questions?
```

Use this variant instead of the Figma/design template above when Step 1a's "Edit" route applies
to an implementation-scope seed and no new external design/spec is being imported.

**Scope = feature** (feature from backlog or assignment):

```yaml
header: "Goal" # what must this feature achieve?
header: "Existing Context" # what's already in the codebase?
header: "Out of Scope" # explicit exclusions?
header: "Definition of Done" # acceptance criteria?
```

**Scope = page / standalone:** use concept template, skip "Session Model".

**Note:** The templates above are guides — headers only. Every question and option MUST be specific to THIS scope instance. Derive concrete, relevant options from the available context (design file, backlog item, conversation).

**After each round**, use AskUserQuestion — **skip this gate only when the previous round's
answer raises something you must resolve before any further round makes sense**: a factual
correction, a request for information you don't have yet, or a rejected premise. A free-text
answer that merely states a preference ("do it this way", "you decide") is a clean answer and
still gets the gate. **Ask the gate at least once before PHASE 3, whatever else happened** —
without that floor the escape swallows every round in a conversation where the user answers
freely, which is most of them. Otherwise ask:

```yaml
header: "Deeper Dive"
question: "Do you want to explore more aspects?"
options:
  - label: "Another round (Recommended)", description: "Explore more aspects of the idea"
  - label: "Proceed to summary", description: "There is enough context for a good concept"
multiSelect: false
```

- **If "Another round":** formulate 2-4 targeted follow-up questions based on gaps from previous rounds
- **If "Proceed to summary":** proceed to PHASE 3

**Further rounds:** same pattern — present the "Deeper Dive" AskUserQuestion after each round, with follow-up questions targeting gaps from previous rounds (features/mechanics specifics, differentiation, style/atmosphere/tone, motivation/engagement model, or any direction the user showed interest in). Switch the recommended option to "Proceed to summary" once enough context has been gathered (typically after 2-3 rounds). The rounds provide structure, not a rigid script — follow the conversation naturally if the user asks their own questions, goes deeper on one topic, or skips questions entirely. **Rule:** if the user answers two consecutive rounds with free-text elaboration or questions-back instead of picking options, run the next round as open questions, not a 4-option modal — the concept is more exploratory than the clickable format serves.

**Before drafting any question**, two kinds of aspect never belong in an option set:

- **Generative** — vision, tone, story/theme, naming/title. Ask a single anchored open question instead ([shared/QUESTIONING.md](../../shared/QUESTIONING.md) governs form choice, anchoring, and escalation).
- **Visual or formal** — layout, geometry, colour, information density, iconography, on-screen wording. Do not ask, **show**: build 3-5 concrete variants first (HTML page, ASCII or markdown mock) with real sample data from the project, then let the user point at one or blend two. A modal whose options the user cannot picture is a modal answered with "you decide" — and then the design was chosen by the executor, not the user.

Clickable rounds stay the default for every other (enumerable) aspect.

**Question rules:**

- NEVER use meta-options ("Answer questions", "Fewer questions")
- Each question = separate AskUserQuestion with concrete, clickable options
- Options are specific to THIS idea, not generic
- Recommended option = most likely answer based on context so far
- "Other" is built-in — user can always type custom input
- `multiSelect: true` where multiple answers make sense
- Maximum 4 questions per round (parallel in one message)
- Adapt question style to idea type (game vs product vs story)
- **Match the wording to `Explanation Level` in CLAUDE.md.** At Beginner level an option label never carries an internal step number, a class name, or a config field — name the thing by what it does for the user. "Stap 0: sizing + risicobewaking" is a label the author understands; "de rekenmachine: hoeveel koop ik bij dit risico" is one the user can pick from
- **A choice between competing designs is a comparison, not a preference** — the Setup "comparison before modal" gate governs it: print the trade-off table first, then ask
- Save criticism or expansion for later--this phase is pure idea capture

---

### PHASE 3: Synthesize and Confirm

1. **Confirmation = the plan-mode ExitPlanMode gate (PHASE 4)** — do not issue a separate confirm modal. Proceed to PHASE 4: accept at ExitPlanMode = generate output; reject = revise, or run another PHASE 2 round before re-exiting. (The Sync route runs outside plan mode and keeps its own confirm in project-sync.md.)
2. **Depth guard:** if the gathered input covers fewer than 3 distinct content aspects (e.g. only title + vague description), recommend one extra PHASE 2 round before generating output.

### PHASE 4: Generate Output

**Open the plan file with a structured overview of all gathered input**, then the concept document itself. Four rules, in order:

1. **Fresh scoping** → a scope-matching aspect table. Columns by scope:
   - concept / standalone / page: Topic, Scope, Target Audience, Core Experience, Deeper Dives
   - implementation: Topic, Source of Truth, Pages in Scope, Tech Stack, Open Decisions
   - feature: Topic, Goal, Existing Context, Out of Scope, Definition of Done
2. **Focused-edit route** → a change-summary instead (before → after per changed aspect), never the full aspect table.
3. These columns are a minimum, not a ceiling. When the rounds surfaced aspects the template has no column for (trade-offs, open decisions, extra dimensions), add rows or columns — do not compress them away to fit.
4. Follow the table with a concise summary before the document starts.

Anchoring the overview to the plan file is deliberate: `ExitPlanMode` always shows that file, so the overview cannot be skipped the way a standalone output step can.

**Iteration rounds — only when the artefact is judged by looking at it.** A design the user assesses visually (a panel, a layout, a colour system) is not settled by one document: the phase loops — variant set → user reaction → revised variant set — and only the last round proceeds to PHASE 5. Rules for the loop:

- One artefact path per round with a version suffix; keep the earlier versions, the user compares against them.
- The mandatory second-opinion hook fires **once, at the save**. Extra consults per round are legitimate but user-requested — never automatic, or every round costs a spawn.
- Each round states in one line what the user's reaction changed **and** what it explicitly did not change. An unrecorded rejection comes back two rounds later as the same proposal.
- The seed is written **once**, at the end of the last round (PHASE 5) — never per round.

Create a structured markdown document (pure markdown, no preamble or "Here's your document:" framing; `#` title, `##` sections). On a full Write of an existing seed, preserve any YAML frontmatter already at the top of the file (e.g. `applied_techniques` from a prior critique/brainstorm run). Required: **Title** (H1), **Short description** (1-2 sentences), **Core concept**. Additional sections by type — pick the set from scope: implementation → Implementation projects; feature/assignment → Features/assignments; concept/page/standalone → judge the content (creative vs product; hybrid → merge both sets):

- Creative concepts (games, stories, art): Characters, Mechanics/Gameplay, Narrative/Plot, Aesthetic/Style, Tone and Atmosphere, Unique Elements
- Product ideas (apps, services, businesses): Target Audience, Key Features, User Journey/Experience, Value Proposition, Differentiation
- Implementation projects (design → code): Source of Truth, Page/Screen Structure, Tech Stack, Implementation Approach, Open Decisions
- Features/assignments (scoped work in an existing project): Goal, Existing Context, Out of Scope, Constraints/Dependencies, Definition of Done

**Second-opinion hook** (after writing the plan file, before `ExitPlanMode`) — always, for
every seed/concept save. This is project-seed's own override of the SECOND-OPINION.md trigger
table: the shared default stays conditional for every other skill, but project-seed always
wants the Fable check. **This is a distinct mechanism** from any user-level Fable-tiering
guidance (e.g. a CLAUDE.md instructing "spawn a Plan subagent with model: fable" for hard
design calls during plan mode) — an earlier ad hoc Fable spawn for architecture/design does
NOT satisfy this hook. Always run the dedicated consult below, even if Fable was already
consulted once earlier in the session for a different purpose.

**One carve-out — fold, don't re-spawn:** if the user themselves requested a consult earlier
_this session_ whose INPUT was this same plan file / full concept draft (not a sub-question
raised before the draft existed), that digest already covers the hook. Skip the fresh spawn,
reuse that digest for the integration step, and log `consulted (user-requested, folded)`.
Spawn fresh only when no such consult ran, or the earlier one predates the full draft.

> **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` § Spawn and § Integrating the digest
> (skip § Gate's trigger table — project-seed's trigger is "always") and follow it — spawn the
> consult (no confirm step, no trigger check) with INPUT = the plan file (project-seed row of
> § Brief contents). Fold the digest into the concept doc before exiting, then print the
> one-line log (§ Logging — no report table here). That printed log line is the record of the
> consult — there is no `project.json` field for it.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) Exit protocol — write the concept document to the plan file, then `ExitPlanMode`.

### PHASE 5: Output Destination — the run is not complete without it

**STOP — approval at `ExitPlanMode` is not the end of the run.** The run ends when a save-confirmation block has been printed. No block, no run — and an approved plan whose result never reached `.project/` is the one failure mode the user cannot see happening.

> **Todo**: Read `.claude/skills/shared/THINKING-OUTPUT.md` — mode `seed`, `{kind}` = `idea`. Follow the scope routing and seed save procedure there.

Two things this phase owns that no other phase does: `seed.scope` is written to the scope **actually used** (a scope switched mid-run otherwise leaves a stale value behind), and § Continue offers the next move. Printing `CONCEPT SAVED` / `THINKING OUTPUT SAVED` is the artefact that proves PHASE 5 ran.

---
