# Content (design-ship copy)

> **design-ship copy** — executed by AGENT 2 (content) under the non-interactive contract, inside
> the build worktree. Your prompt already carries `$TARGET`, `$ARCHETYPE`, `$BRIEF` (confirmed by
> the user in design-ship PHASE 0) and the worktree path. `MODE = single` — never batch. Source
> files live in the worktree; `.project/` paths resolve to the main repo.

Fill built pages and components with real, on-brand copy. Runs after `design-create` build/convert
and before `design-check`. Upgrades contextual placeholders to reviewed, seed-grounded text via an
intentional pipeline: archetype → brief → scan → generate → review → apply.

**Pipeline position:** `design-tokens → design-create → design-content → design-check`

**Related skills:** `/design-create` · `/design-check` · `/marketing-research`

## References

- `.claude/skills/shared/SEED.md` — Seed reader (name, pitch, full concept markdown)
- `.claude/skills/shared/DESIGN.md § UX Writing` — Button labels, error messages, empty states, term consistency
- `.claude/skills/shared/BACKLOG.md` — Backlog read/write protocol
- `.claude/skills/shared/PROJECT-CONTEXT-LOAD.md` — entities/learnings (content profile — see §0.3)
- `.claude/skills/design-ship/references/design-content/references/content-generation.md` — Generation rules per element category + glossary (PHASE 3 — read the original in place)
- `.claude/skills/design-ship/references/design-content/apply-and-sync.md` — Apply strategy, backlog write, report (PHASE 5 — design-ship copy)
- PHASE 1 (scope-intent) and PHASE 4 (review-gate) are replaced in this copy — see those phases below

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the
start and `completed` at the end. During context compaction the task list remains
visible — no risk of forgetting phases.

1. PHASE 0: Pre-flight & modus — modus bepalen, context laden, bestanden vinden, i18n detecteren
2. PHASE 1: Scope & intent — archetype, content-brief, CHECKPOINT (+ optionele research-hook)
3. PHASE 2: Scan — placeholders + copy-elementen detecteren, KEEP bestaande copy markeren
4. PHASE 3: Generate — copy per categorie genereren (archetype-tuned, glossary-consistent)
5. PHASE 4: Review & approve — before→after-tabel, Apply / Edit / Regenerate / Cancel
6. PHASE 5: Apply + sync + report — schrijven naar code/i18n, backlog-sync, rapport

---

## PHASE 0: Pre-flight & modus

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

### 0.1 Modus bepalen

Drie aanroep-modi:

**A — Board-knop / één arg:**

```
$SKILL_ARG given  →  MODE = single, TARGET = $SKILL_ARG
transition === "contenting" in backlog  →  MODE = single, TARGET = feature.name
```

**B — Queue/batch (geen arg, geen matching transition):**

```
Read .project/backlog.json
Candidates = features where:
  (type === "PAGE" || type === "COMPONENT")
  && status === "DOING"
  && stage === "built"
  && contentStatus !== "filled"

0 candidates  →  show:
  "design-content: Nothing to fill.
   All built PAGE/COMPONENT items already have contentStatus: filled,
   or no built items exist yet. Run /design-create first."
  Stop.

≤ 3 candidates  →  $TARGETS = all candidates, log "Queue: auto-selected {names}"
> 3 candidates  →  AskUserQuestion:
  header: "Queue"
  question: "Which pages/components do you want to fill with copy?"
  options: one per candidate — label: {name} ({type}), description: {description}
  multiSelect: true
```

Store: `$TARGETS` (list, always), `$MODE` (`single` | `batch`). For single: `$TARGETS = [{name: $TARGET}]`.

```
Modus:   {single — {target} | batch — {N} targets: {names}}
```

### 0.2 Context laden

For each target in `$TARGETS`, record type (PAGE/COMPONENT) from backlog or design spec.

Read `.project/project.json`. Store:

- `$SEED` via `shared/SEED.md` reader (name, pitch, markdown)
- `$DESIGN` = `project.json#design`
- `$THEME` = `project.json#theme` (voice, brand-mood, `voice.terms` glossary if present)

Per target: locate spec in `$DESIGN` (`pages[]` or `components[]`). Store as `$SPEC[target]` (null if absent).

```
Seed:    [✓] {$SEED.name} — {$SEED.pitch}
Theme:   [✓|✗] voice "{$THEME.voice}" | no theme voice defined
```

### 0.3 Project-context laden (entities + learnings)

```bash
node -e "
  const p = require('.project/project.json');
  console.log(JSON.stringify({
    entities: (p.data?.entities || []).map(e => ({ name: e.name, fields: (e.fields || []).slice(0, 8) })).slice(0, 20),
    glossary: p.theme?.voice?.terms || null
  }, null, 2));
" 2>/dev/null || echo "{}"

node -e "
  const c = require('.project/project-context.json');
  console.log(JSON.stringify({
    learnings: (c.learnings || [])
      .filter(l => l.type === 'pitfall' || l.scope === 'architectural')
      .slice(0, 10)
  }, null, 2));
" 2>/dev/null || echo "{}"
```

Store `$ENTITIES`, `$GLOSSARY`, `$LEARNINGS`. If files absent → treat all as empty.

### 0.4 Bestanden + feature-context vinden

Per target:

1. Check `.project/features/{target}/feature.json` → read `files[]` and `requirements[]`. Store as `$FILES[target]` and `$REQS[target]`.
2. If `files[]` empty/absent → glob `src/**/{target}*`, `app/**/{target}*` — filter `.tsx .vue .svelte .jsx .js .ts .html`.
3. Still empty → AskUserQuestion (manual path entry or skip).

Also read `backlog.json` features for target: collect `dependencies[]`, `pageHint[]`, and dep-feature `description`s. Store as `$PAGE_CONTEXT[target]`.

```
Files:   [✓] {target}: {N} file(s) — {list}   (per target)
```

### 0.5 i18n detecteren

Glob: `src/i18n/**/*.json`, `locales/**/*.json`, `messages/**/*.json`, `public/locales/**/*.json`, `src/strings.ts`, `src/constants/strings.*`.

Found → `$I18N_FILE = path`, `$I18N_MODE = true`. Print: `i18n: [✓] {path}`
Not found → `$I18N_MODE = false`. Print: `i18n: [✗] none — inline copy`

---

## PHASE 1: Scope & intent

> **design-ship: SKIP this phase.** `$ARCHETYPE` and `$BRIEF` were derived and confirmed by the
> user in design-ship PHASE 0 and are in your prompt. Do not read `scope-intent.md`, do not
> re-classify, do not re-ask the brief. The marketing-research hook is also resolved there
> (`$BRIEF.researchContext` is either loaded or null). Continue to PHASE 2.

---

## PHASE 2: Scan

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Scan each file in `$FILES[target]` (per target, sequentially for batch). Collect per target:

**Placeholder signals** — strings to replace:

- Generic labels: "Button", "Label", "Title", "Description", "Heading", "Placeholder"
- Seed-name–matched section titles used verbatim as text (e.g. `<h1>checkout</h1>`)
- Empty string attributes where content is expected (`alt=""` on non-decorative, `aria-label=""`, `placeholder=""`)
- Empty-state containers with no text child

**Copy-dragende elementen** — expected to have real copy:

- All `<button>`, `<a>`, `<label>`, `<h1>`–`<h6>`, `<p>`
- `placeholder`, `aria-label`, `alt` attributes
- **Copy in JS/TS logic** — string literals in:
  - toast/notification calls (e.g. `toast("…")`, `notify("…")`, `showToast({message: "…"})`)
  - validation/form error variables (`errorMsg`, `validationMessage`, `helperText`, `errorText`)
  - inline string-only variables assigned near render paths (`const emptyText = "…"`, `const label = "…"`)
- **Metadata fields** (PAGE targets only): `<title>`, `<meta name="description">`, `<meta property="og:title">`,
  `<meta property="og:description">`, Next.js `metadata.title`/`metadata.description`/`metadata.openGraph`
  export, `react-helmet`/`next/head` contents

**KEEP-markers** — do NOT overwrite:

- Strings ≥ 8 words that sound product-specific (contain seed domain terms)
- Strings already matching `$GLOSSARY` terms
- `aria-label` / `alt` that are clearly authored (non-empty, specific)

Store as `$PLACEHOLDER_MAP[target]` with KEEP/REPLACE flag per entry.

```
Scan:    {target}: {N} placeholder(s), {K} KEEP — {per-target line for batch}
```

If all targets return 0 placeholders:

```
Scan:    No placeholders found — pages/components may already have real copy.
         Check via git diff or run /design-check to audit.
```

Stop (no backlog write, no transition clear — standalone runs only; backlog items keep transition for retry).

---

## PHASE 3: Generate

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Read `.claude/skills/design-ship/references/design-content/references/content-generation.md` and follow that procedure to produce `$COPY_MAP`.

---

## PHASE 4: Review & approve

> **design-ship: AUTO-APPLY — do not read `review-gate.md`, do not present a before→after
> approval.** The human copy review happens later, in design-ship PHASE 4 (main chat), against
> the live page. Instead: build the review payload for your result — `copyTable[]`, one entry per
> `$COPY_MAP` item: `{ element, category, before (≤40 chars), after (≤60 chars) }` — then proceed
> directly to PHASE 5 and apply everything. Respect the KEEP-markers from PHASE 2 as usual.

---

## PHASE 5: Apply + sync + report

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. Read `.claude/skills/design-ship/references/design-content/apply-and-sync.md` and follow that procedure.

> **Todo**: mark PHASE 5 → `completed`.
