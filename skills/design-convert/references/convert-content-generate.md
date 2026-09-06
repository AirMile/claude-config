# Content Generation — PHASE 3

Loaded from `route-content.md` PHASE 3 (standalone entry) or `route-convert.md § PHASE 2c` step 2
(mid-convert entry). Inputs: `$TARGETS`, `$PLACEHOLDER_MAP`, `$BRIEF`, `$SEED`,
`$SPEC`, `$THEME`, `$ENTITIES`, `$GLOSSARY`, `$REQS`, `$PAGE_CONTEXT`, `$RESEARCH_CONTEXT`.

Produce `$COPY_MAP` — a structured list of `{target, file, element, old, new, category, rationale}`.

---

## 3.1 Grounding context

Every generated string must trace to one of these sources — no generic copy that could belong to
any app:

```
PRODUCT_NAME  = $SEED.name
PITCH         = $SEED.pitch
CONCEPT       = $SEED.markdown          (domain, audience, entities, workflows)
PAGE_SPEC     = $SPEC[target].sections  (what each section communicates — PAGE)
COMP_SPEC     = $SPEC[target].scope     (scope + description — COMPONENT)
FEATURES      = $PAGE_CONTEXT[target]   (dep-feature names + descriptions → capabilities)
ENTITIES      = $ENTITIES               (real field/entity names → labels, table headers)
REQUIREMENTS  = $REQS[target]           (acceptance criteria → exact user-facing actions)
VOICE         = $BRIEF.tone + $BRIEF.language
MUST_INCLUDE  = $BRIEF.mustInclude      (locked phrases, if any)
RESEARCH      = $RESEARCH_CONTEXT       (marketing archetype only)
```

---

## 3.2 Archetype-tuning

Apply tone and length rules based on `$ARCHETYPE[target]` (per-target; use
`$BRIEF.perTargetOverrides[name]` if set):

### marketing/landing

- **Goal:** persuade, create desire, drive one action
- **Headings:** outcome + emotion, ≤8 words — "Plan je week in één oogopslag" not "Week Planning"
- **Body:** scan-friendly, bullet-forward, benefit not feature — "spend less time planning" not "has planning feature"
- **CTA:** one primary, urgent verb — "Start gratis", "Probeer nu", "Vraag demo aan"
- **Empty states:** never shown on marketing pages — skip category
- **Errors:** brief, reassuring — "Iets ging mis. Probeer opnieuw."
- Ground in `$RESEARCH_CONTEXT` value-props and audience language if available

### transactional/form

- **Goal:** reduce friction, build trust, prevent mistakes
- **Headings:** task-oriented, step-clear — "Controleer je bestelling" not "Checkout"
- **Labels:** noun only, no "Enter your …" — `placeholder` shows format example
- **CTA:** specific verb + object — "Bestelling plaatsen", "Account aanmaken", "Wachtwoord instellen"
- **Validation/error:** format + fix instruction — "[Veld] moet [formaat] zijn. Voorbeeld: [voorbeeld]"
- **Success:** confirm action + next step — "Account aangemaakt — check je e-mail"
- Ground in `$REQUIREMENTS` acceptance-criteria for exact field names

### functional/app

- **Goal:** clarity and efficiency — users are in task mode, not reading mode
- **Headings:** noun-phrase for navigation, verb-phrase for actions — "Bestellingen" / "Nieuwe bestelling"
- **Body:** concise, scannable, one idea per sentence; surface domain detail from `$ENTITIES`
- **CTA:** specific verb + object — "Opslaan", "Verwijderen", "Exporteren als CSV"
- **Empty states:** onboarding moment — acknowledge + value + action
- **Errors:** what + why + fix — follow `shared/DESIGN.md § UX Writing → Error Messages` exactly
- Ground in `$ENTITIES` field names for form labels and table headers

---

## 3.3 Generation rules per element category

Apply to each REPLACE entry in `$PLACEHOLDER_MAP[target]`:

### Headings (`h1`–`h6`, hero titles, section titles)

- Name the outcome, not the feature
- `h1` = one clear value proposition grounded in `$PITCH`
- Sub-headings: expand with domain specifics from concept; avoid "Our features"

### Body text (`p`, subtitles, card descriptions)

- One idea per sentence; no padding sentences
- Derive from seed concept — surface real domain detail (entities, actions, workflows)
- Max 2 sentences for supporting text unless spec has a content brief

### CTA labels (`button`, `a`, form submit)

Follow `shared/DESIGN.md § UX Writing → Button Labels`:

- Specific verb + object; never "OK", "Submit", "Yes/No"
- Destructive: name the destruction — "5 items verwijderen" not "Verwijderen"

### Labels / form fields (`label`, `placeholder`, `aria-label`)

- Label: concise noun, no "Enter your …"
- Placeholder: example format only — "jan@example.nl", "DD-MM-JJJJ"
- `aria-label` on icon buttons: "[verb] [subject]" — "Dialoog sluiten", "Item verwijderen"
- `alt` on images: describe content; `alt=""` for decorative

### Empty states

Follow `shared/DESIGN.md § UX Writing → Empty States`:

1. Acknowledge briefly (don't blame user)
2. Explain the value
3. Provide a clear action (CTA that creates the first item)

### Error / validation messages

Follow `shared/DESIGN.md § UX Writing → Error Messages` — always: (1) What? (2) Why? (3) Fix?

| Situation        | Template                                                            |
| ---------------- | ------------------------------------------------------------------- |
| Format error     | "[Veld] moet [formaat] zijn. Voorbeeld: [voorbeeld]"                |
| Missing required | "Vul [ontbrekend veld] in"                                          |
| Network error    | "Kon [service] niet bereiken. Controleer de verbinding en [actie]." |
| Server error     | "Er ging iets mis aan onze kant. [Alternatieve actie]"              |

Never blame the user.

### Success / confirmation messages

- Confirm action + next step: "Wijzigingen opgeslagen", "Account aangemaakt — check je e-mail"

### Navigation (`nav`, sidebar, tabs, breadcrumb)

- Single noun or short noun-phrase; match domain vocabulary from `$ENTITIES` + `$PAGE_CONTEXT`

### Loading / skeleton

- Omit unless unavoidable; if required: "[Entity] laden…" e.g. "Bestellingen laden…"

---

## 3.4 Term consistency (glossary)

Before finalising `$COPY_MAP`, run a consistency pass:

1. **Load existing glossary:** `$GLOSSARY = $THEME.voice.terms` (object: `{ "sign in": "Inloggen", ... }`)
2. **Scan generated strings** for synonym drift against `shared/DESIGN.md § UX Writing → Consistency`
3. **Align to existing terms** — if "Verwijderen" is already used in the codebase or glossary, don't introduce "Wissen"
4. **Add new terms** to `$GLOSSARY_UPDATES` (terms decided during this run that weren't in the glossary yet)

Grep the target files for a sample of existing button/nav labels before finalising, to catch any
terms not yet in `$GLOSSARY`.

---

## 3.5 Undo > confirm

Follow `shared/DESIGN.md § UX Writing → Undo > Confirm`:

- Generic "Weet je het zeker?" + "Ja/Nee" → rename to "[Actie] [object]" + undo-toast copy
- Only keep hard-confirm copy for truly irreversible or high-cost actions

---

## 3.6 Metadata/SEO copy (PAGE targets only)

Skip for COMPONENT targets and for `$ARCHETYPE === "marketing"` pages that already have explicit
meta tags in source.

**Auto-detect framework convention** from `$FILES[target]` — check in order:

| Signal in file                                                         | Convention             |
| ---------------------------------------------------------------------- | ---------------------- |
| `export const metadata = {` / `export async function generateMetadata` | Next.js 13+ App Router |
| `import Head from 'next/head'` / `<Head>`                              | Next.js Pages Router   |
| `import { Helmet }` / `<Helmet>`                                       | react-helmet           |
| `<title>` tag directly in component/template                           | Static HTML or other   |

**Derive values from:**

- `title` → `{$SEED.name} — {$SPEC[target].purpose or section heading}` (≤60 chars; unique per page)
- `description` → one-sentence benefit statement from `$SEED.pitch` + page context (≤160 chars)
- `og:title` → same as `title`, or slightly looser (up to 70 chars)
- `og:description` → same as `description`
- `og:image` → skip (asset — not copy)

Add each as a separate entry in `$COPY_MAP` with `category: "metadata"`.

If the framework convention cannot be detected → skip silently (note in report: `Metadata: skipped — no
known head-management pattern found`).

---

## 3.7 Produce `$COPY_MAP`

For each REPLACE entry in `$PLACEHOLDER_MAP[target]`:

```json
{
  "target": "<name>",
  "file": "<path>",
  "element": "<selector or description>",
  "old": "<original string>",
  "new": "<generated string>",
  "category": "<heading|body|cta|label|empty-state|error|success|nav|loading|metadata>",
  "rationale": "<one-line trace: seed/spec/entity/requirement/rule>"
}
```

Skip KEEP entries. If `$COPY_MAP` is empty after generation → print:

```
Generate: All existing copy is already real — nothing to replace.
```

Stop without backlog write.

Print:

```
Generate: {N} copy items — headings: {N}, cta: {N}, labels: {N}, empty-states: {N}, errors: {N}, metadata: {N}, other: {N}
          Glossary: {K} new terms added
```

Then continue to PHASE 4 (`convert-content-review.md`).
