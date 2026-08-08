---
name: project-todo
description: Use with /project-todo to capture an idea or finding as a backlog item.
reads: [project.stack, project.design, backlog.status, concept.seed]
writes:
  [
    backlog.status,
    backlog.features,
    backlog.seedDrift,
    concept.seed,
    project.stack,
    project.thinking,
  ]
metadata:
  author: claude-config
  version: 2.3.0
  category: project
---

# Todo

Capture new backlog items and add them to the backlog. The bridge between "I have an idea" and a backlog item ready for `/dev-ship (define phase)` (web) or `/game-ship (define phase)` (game).

**Trigger**: `/project-todo` or `/project-todo [description]`

**Autonomous by default.** Priority, type and dependencies are inferred from the description — never asked. The happy path runs with zero modals. Only the ambiguity gate (PHASE 1x) may raise a question, and only for the criteria listed there.

This matters beyond convenience: `dev-ship` and `game-ship` route out-of-scope findings here from inside the manual walkthrough and the live playtest. The user is present at those call sites, so the gate may fire normally — but parking three findings used to cost twelve modals. Adding a todo should cost one sentence.

## When to Use

- User has a new feature, change, bug fix, improvement, mechanic, or content idea for an existing project
- User wants to quickly capture an item without full `/project-plan`

NOT for: concept-level ideation (`/project-seed`), iterating on existing items (`/project-seed brainstorm`, `/project-seed critique`).

## Workflow

### Pre-PHASE 0: Project Detection

Check whether `.project/project.json` exists.

- **Exists** → read it, go to Stack Detection.
- **Does not exist** → detect the project type from the filesystem, scaffold silently, continue. No modal.
  - `project.godot` present → GAME
  - otherwise → WEB
  - neither detectable (empty dir) → this is gate criterion 5; fold the question into the PHASE 1x modal.

  Write two files:
  1. `.project/project.json` — `{ "name": "{dir name}", "created": "{YYYY-MM-DD}", "stack": {}, "features": [] }`, with `"stack": { "engine": "godot" }` for GAME.
  2. `.project/session/setup-pending.json` — `{ "source": "/project-todo", "mode": "greenfield", "createdAt": "{YYYY-MM-DD}" }`

  Show: `PROJECT.JSON CREATED — run /core-setup later for full setup.`

### Stack Detection (pre-PHASE 0)

`stack.engine === "godot"` OR `concept.platform === "game"` → **GAME MODE**. Otherwise → **WEB MODE**.

```
STACK: web    (→ /dev-ship pipeline)
STACK: game   (→ /game-ship pipeline)
```

### PHASE 0: Input + Backlog Check

1. **Determine description:**
   - Argument provided → use as starting description
   - No argument → ask the user directly: "What do you want to add to the backlog?" Wait for their answer.

   **Provenance token (strip before anything else):** a calling skill passes an explicit
   `origin agent via /{skill}` token inside the sentence (`shared/BACKLOG.md § Card provenance`).
   Detect it, record `CARD_ORIGIN` / `CARD_SOURCE`, and **remove the token from the description
   text** so it never lands on the card:
   - Token present → `CARD_ORIGIN = "agent"`, `CARD_SOURCE = "/{skill}"`.
   - No token, user typed `/project-todo` themselves → `CARD_ORIGIN = "user"`, `CARD_SOURCE = "/project-todo"`.
   - No token but a skill invoked this run → `CARD_ORIGIN` **unset** (the field is omitted
     entirely), `CARD_SOURCE = "/project-todo"`. Never fall back to `"user"` here: that would
     relabel an un-migrated caller as human intent, and provenance you cannot trust is worse than
     provenance you do not have.

   Both values are carried through the whole run and applied identically in PHASE 2 steps 3 and 8.
   In a multi-item split every child inherits them — the split is a formatting decision, not a
   change of who asked.

2. **Size advisory (no modal):**

   Count indicators of a large feature: multiple components/layers, cross-cutting concern, unbounded scope, multiple phases, keywords "redesign", "overhaul", "full", "entire", "system".

   **≥2 indicators** → print one advisory line, then continue normally:

   ```
   ⚠ Large feature — consider /project-seed to structure it. Adding as a todo for now.
   ```

   Fewer than 2: no output.

3. **Multi-item split (automatic, no modal):**

   **[GAME MODE]:** skip. Multi-item split is a dev/frontend concept and does not apply to MECHANIC/SYSTEM/CONTENT/POLISH/UI.

   **[WEB MODE]:** detect cross-domain signals — connectors ("including", "with accompanying", "and the page", "plus frontend"), or an explicit description of both backend/logic/API and UI/page/component.

   **Detected** → split automatically into 2-3 sub-items (max 3), each `{ name (kebab), type, description }`, using the § Type inference tables. Link them: frontend children get `dependencies: ["<dev-parent-name>"]`. Set the internal queue `items = [...]` and report the split in PHASE 3 output. No confirmation prompt.

   **Not detected** → `items = [single item]`.

4. **Backlog check:**
   - Read `.project/backlog.json`
   - **Not found** → create it (see `shared/BACKLOG.md § Writing` for the legacy `backlog.html` migration rule):
     1. `mkdir -p .project`
     2. Write a minimal data object:
        ```json
        {
          "schemaVersion": 2,
          "project": "{project directory name}",
          "generated": "{YYYY-MM-DD}",
          "updated": "{YYYY-MM-DD}",
          "source": "/project-todo",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Found** → parse JSON, generate the kebab-case name(s), then check for an existing item that means the same thing. An exact name match is not enough: `add-dark-mode` does not collide with an existing `dark-mode-theme`, yet they are the same card. Match on **both**:
     1. **Name equality** — `data.features.find(f => f.name === kebabName)`
     2. **Token overlap** — tokenize (tokens ≥ 3 chars, the same tokenizer as § Dependencies inference) the new name plus the key nouns of its description, and compare against each existing item's name + description. **≥ 2 shared tokens** makes it a candidate; then judge semantically whether it is really the same thing.

     Resolve:
     - **No candidate** → continue.
     - **Evidently the same thing** → do not add. Report the existing item and its status, suggest `/project-seed brainstorm {name}` to deepen it. Stop.
     - **Evidently different intent** (name collision only) → silently append a suffix (`-2`, `-3`).
     - **Overlapping but unclear** → gate criterion 3; carry into PHASE 1x.
     - **Multi-item:** also check collisions between queue names. Always resolve silently with a suffix — never gate.

### PHASE 1: Inference

> **Todo**: Read '.claude/skills/project-todo/references/inference-rules.md' — type, priority and dependency tables plus the ambiguity gate criteria.

Per queue item, derive:

- **`type`** — § Type inference table for the active mode, first match wins. Row 5 (`PAGE-GAP`) resolves against the page register: `project.json#design.pages[]` (already read in Pre-PHASE 0) plus any `backlog.json` feature with `type: "PAGE"`.
- **`phase`** — § Priority inference table. Uncertain → `P2`. Never a modal.
- **`dependencies`** — § Dependencies inference against the existing backlog names.
- **`description`** — a self-contained card per `shared/BACKLOG.md § Description quality`: concrete observable behavior, scope boundary, 1–3 sentences. Never a restatement of the name.

  **When `CARD_ORIGIN === "agent"`**, apply § Description quality → **Lead sentence** as well: the incoming sentence is a finding written for whoever held the code, so rewrite it into a plain-language lead (what is wrong + the consequence, no paths/symbols/test names in the first six words) followed by the technical locator. Do **not** paste the caller's sentence through verbatim — that is exactly what produces board rows nobody can scan. A user-typed description is exempt; keep their wording.

Record, per field, whether the inference was **certain** or hit a gate criterion. Track why each choice was made — PHASE 3 reports it.

**Seed alignment scan** (after the field derivation, before the gate):

> **Todo**: run the Reader from `shared/SEED.md` once (cache `SEED_CONTEXT` across the queue). If `SEED_CONTEXT.present` → Read '.claude/skills/project-todo/references/seed-alignment.md' and run its § Alignment scan per queue item; otherwise skip silently.

Verdict per item: `aligned`, or `drift { category, entry, proposedEdit }`, or `drift { category, entry, record-only }`. Quality types (BUG/PERF/A11Y/THEME/POLISH) default to aligned; when unsure → aligned.

### PHASE 1x: Ambiguity Gate

Check the five criteria in `references/inference-rules.md § Ambiguity gate`. None triggered, and no drift verdict carries a `proposedEdit` → **no modal at all**, straight to PHASE 2.

One or more triggered → **one** `AskUserQuestion` call, at most 4 questions, one per triggered criterion. Never two calls in one run. The first option is always the inference result marked `(Recommended)`, so accepting the default equals full-auto.

If any PHASE 1 verdict carries a `proposedEdit` and no escape-hatch condition holds (`references/seed-alignment.md § Escape hatch`), append **one** extra "Seed update" question to this same single call, per `seed-alignment.md § Seed update question` — with the literal edit(s) as `preview`. The 4-question cap still wins: cap full → drop the seed question and downgrade its edits to record-only. This never justifies a second call.

If criterion 2 (thin description) fired, fold the answers into the sharpened description — that is the only path that later writes a thinking doc.

### PHASE 2: Write to Backlog + Thinking

**Loop:** all steps run per item in the queue. For a single item, `items = [single item]`. For multi-item, steps 1-8 run sequentially per item, where `dependencies[]` refers to previously processed items in the batch.

1. Read `.project/backlog.json` → parse JSON

2. **Generate name:** kebab-case from description (e.g. "Dash ability with cooldown" → `dash-ability`)

3. **Insert into `data.features[]`** — add the new object after the last item with `status: "DOING"` or `status: "TODO"`, or at the start if there are no active items:

   ```json
   {
     "name": "{kebab-case-name}",
     "type": "{inferred type}",
     "status": "TODO",
     "transition": "designing",
     "phase": "{inferred priority}",
     "description": "{inferred description}",
     "source": "{CARD_SOURCE}",
     "origin": "{CARD_ORIGIN}",
     "dependencies": []
   }
   ```

   **`description` norm:** apply `shared/BACKLOG.md § Description quality` — self-contained, concrete behavior + scope boundary, gate answers (PHASE 1x) folded in, 1–3 sentences, and for an agent-parked card the mandatory **lead sentence** before the locator. The card text is the only context `/dev-ship` (define phase) / `/game-ship` (define phase) gets when it is picked up later; never write a bare restatement of the name.

   **`transition` rule:** only include `"transition": "designing"` when `type === "PAGE"` or `type === "COMPONENT"`. Omit the field entirely for all other types (FEATURE, API, THEME, PAGE-GAP, etc.).

   **`source` / `origin` rule:** both come from PHASE 0 step 1 (`CARD_SOURCE` / `CARD_ORIGIN`), never hardcoded. `CARD_ORIGIN` unset → **omit the `origin` key entirely**; never write `null` and never default to `"user"`. Any `source` value keeps the card INDEPENDENT for `/project-plan` (the rule is `!== "/project-plan"`, not `=== "/project-todo"` — see `shared/BACKLOG.md § Source field convention`), so a re-stamped `"/dev-ship"` is still protected from a backlog rebuild.

4. **Update metadata:** set `data.updated` to current date (`YYYY-MM-DD`)

5. **Seed drift resolution** (executes the PHASE 1 verdict + 1x answer — no new modal, no re-scan):
   - **Aligned** → log `Seed: ✓ aligned`, done.
   - **Approved edit** (user picked "Apply edit(s)" in the PHASE 1x call) → apply the previewed Edit(s) literally to `.project/project-seed.md`, then the co-updates per `shared/SEED.md § Write targets` (pitch only when the replaced sentence appears in `seed.pitch`; `backlog.json#data.overview` rides the step-6 write pass). Details: `references/seed-alignment.md § Write path`. Log: `Seed: ✓ updated — {n} edit(s) applied`.
   - **Declined / record-only / escape hatch** → prepare the drift `entry` (real `category`, verbatim `seedSays` for contradictions) per `shared/SEED.md § Drift entry schema` with `source: "/project-todo"`, `ref: "feature:{name}"`, for later `/project-seed § Sync` pickup. Log: `Seed: ⚠ drift recorded — {category}: {name}`.

6. **Write back:** Edit the JSON in `.project/backlog.json`. Find a unique anchor in the existing features array and use Edit to insert the new object before it. Prepared drift entries from step 5 are appended to `data.seedDrift[]` in this same write pass (initialize the array if absent) — no separate write roundtrip.

7. **Write thinking output** (only if gate criterion 2 fired):

   Path: `.project/thinking/feature-idea-{name}.md` — `mkdir -p .project/thinking`

   ```markdown
   # {Item Name}

   ## Description

   {sharpened description}

   ## {Question header 1}

   {answer}

   ## {Question header 2}

   {answer, if asked}
   ```

   No mutation to `project.json` for thinking — output goes in separate md files per DASHBOARD.md.

8. **Sync to `project.json.features[]`** (concept sync):
   - Read `.project/project.json` (already read in Pre-PHASE 0)
   - Initialize `features = []` if missing
   - Check duplicate on `name` — if found and status > TODO: MERGE (update `summary`, preserve status). Otherwise push:

     ```json
     {
       "name": "{kebab-name}",
       "type": "{type}",
       "status": "TODO",
       "phase": "{P1-P4}",
       "summary": "{description, max 200 chars}",
       "dependencies": [],
       "source": "{CARD_SOURCE}",
       "origin": "{CARD_ORIGIN}",
       "created": "{YYYY-MM-DD}"
     }
     ```

     Same `source`/`origin` rule as step 3 — identical values, and `origin` omitted entirely when unset. Writing one file with provenance and the other without desyncs the dashboard silently.

   - Write `.project/project.json`

   `seed.content` is legacy — never write it. `project-seed.md` is only ever touched by the approved surgical path in step 5.

### PHASE 3: Output

Always report what was inferred and why, plus the correction line — the gate buys correctness cheaply after the fact instead of expensively up front. Always print the `Seed:` verdict line — its presence is the forcing function that the PHASE 1 alignment scan actually ran.

**[MULTI-ITEM — when items queue > 1]:**

```
TODOS ADDED ({n} items — auto-split)

  1. {name-1}    {phase} · {type}
     {description-1}

  2. {name-2}    {phase} · {type}     ← depends on: {name-1}
     {description-2}

  Seed: {✓ aligned | updated — {n} edit(s) applied | ⚠ drift recorded — {category}}  ← always shown, the PHASE 2 step-5 verdict
  ⚠ {N} pending drift item(s) in backlog — run /project-seed → "Sync with project"
                                      ← only if data.seedDrift[].length ≥ 3 after the write
  Backlog: .project/backlog.json
  Adjust? Say "make {name-1} P1" or "{name-2} should be COMPONENT".
  Next steps:
  [Per item, appropriate next step from the WEB/GAME MODE output below]
```

**[WEB MODE — single item]:**

```
TODO ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if gate criterion 2 fired
  Seed: {✓ aligned | updated — {n} edit(s) applied | ⚠ drift recorded — {category}}  ← always shown, the PHASE 2 step-5 verdict
  ⚠ {N} pending drift item(s) in backlog — run /project-seed → "Sync with project"
                                                        ← only if data.seedDrift[].length ≥ 3 after the write

  Inferred: {phase} ({reason}) · {type} ({reason})
  Adjust? Say "make it P1" or "type is COMPONENT".

  Backlog: .project/backlog.json
  Next steps:
  - /project-seed brainstorm {name} - Deepen the idea with variations
  - /project-seed critique {name} - Test the idea critically
  [If type is FEATURE, CHANGE, BUG, or API:]
  - /dev-ship {name} - Start with requirements and building
  - /team-outsource {name} - Outsource to a teammate via GitHub/Jira/Linear
  [If type is TWEAK:]
  - /dev-tweak {name} - Pick up the tweak on main (no worktree needed)
  [If type is PAGE or COMPONENT:]
  - /design-convert {name} - Build the page/component
  - /design-convert - Define multiple pages at once
  [If type is THEME:]
  - /design-tokens - Set up design tokens (color, typography, spacing)
  [If type is A11Y:]
  - /design-ship {name} - Ship the page (build + runtime check: a11y/perf/SEO)
  [If type is PERF:]
  - /design-ship {name} - Ship the page; its check phase runs the performance and SEO audit
  [If type is PAGE-GAP:]
  - /dev-ship {name} - Define the missing functionality
  [If type is VERIFY:]
  - /dev-manual {parentFeature} - Re-run the deferred manual test(s) once the blocker ships
```

**[GAME MODE]:**

```
FEATURE ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if gate criterion 2 fired
  Seed: {✓ aligned | updated — {n} edit(s) applied | ⚠ drift recorded — {category}}  ← always shown, the PHASE 2 step-5 verdict
  ⚠ {N} pending drift item(s) in backlog — run /project-seed → "Sync with project"
                                                        ← only if data.seedDrift[].length ≥ 3 after the write

  Inferred: {phase} ({reason}) · {type} ({reason})
  Adjust? Say "make it P1" or "type is SYSTEM".
  Consider /game-debug for an existing-behavior bug.    ← only on bug signals

  Backlog: .project/backlog.json
  Next steps:
  - /project-seed brainstorm {name} - Deepen the idea with variations
  - /project-seed critique {name} - Test the idea critically
  - /game-ship {name} - Start with requirements and architecture
```

### PHASE 4: Correction

Fires only when the user adjusts a field in the same turn, in response to the PHASE 3 correction line ("make it P1", "type is COMPONENT", "it depends on auth-api"). This is what makes zero-modal inference safe: a wrong guess costs one sentence to undo.

**Correctable fields:** `phase`, `type`, `dependencies`. Anything else (rewriting the description, rethinking the idea) → point at `/project-seed brainstorm {name}` and stop.

1. **Patch both files.** The card lives in `backlog.json#features[]` (PHASE 2 step 3) _and_ `project.json#features[]` (PHASE 2 step 8). Patching one desyncs the dashboard silently. Use the read-parallel → mutate → write-parallel batch from `shared/BACKLOG.md § Parallel sync`.

2. **Recompute `transition` when `type` changes.** This is the trap:
   - to `PAGE`/`COMPONENT` → **add** `"transition": "designing"`, otherwise `/design-convert` will never pick the card up
   - away from `PAGE`/`COMPONENT` → **remove** the `transition` field entirely
   - neither side is `PAGE`/`COMPONENT` → leave it absent

3. **Recompute `phase` only if the user did not name one.** A type correction does not silently re-derive priority — the user already saw and accepted it.

4. Idempotent: applying the same correction twice yields the same state.

Log one line per field: `Corrected: {field} {old} → {new}` (plus `transition: added|removed` when step 2 fired).

## Restrictions

- Do NOT write implementation code
- Do NOT modify existing items in the backlog (PHASE 4 corrects only the item just added, in the same turn)
- Do NOT ask for priority, type, category or dependencies — the inference rules resolve them. Only the five ambiguity-gate criteria may raise a question, in a single bundled `AskUserQuestion`
- Do NOT raise more than one `AskUserQuestion` call per run
- Max 3 items per batch during auto-split
- Gate criterion 2: max 2 clarifying questions
- Seed writes ONLY via the approved surgical path (PHASE 2 step 5, `references/seed-alignment.md § Surgical edit contract`) — a single targeted Edit or section append, never a rewrite. Everything else in `project-seed.md`/`seed.*` is owned by `/project-seed`; `seed.content` is legacy and never written

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
