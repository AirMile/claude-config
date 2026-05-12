# Concept Reader Protocol

Hoe een skill concept-context leest. Consumer-skills verwijzen hiernaar i.p.v. inline herhalen.

**Owner:** `/thinking-concept` is de enige skill die `project-concept.md` muteert.
Alle andere skills zijn read-only consumers.

---

## Reader (uitvoering)

Voer dit eenmalig uit aan het begin van de relevante fase:

1. Lees `.project/project-concept.md` als die bestaat → `md_content`
2. Lees `.project/project.json#concept` → extract `name`, `pitch`

Output: `CONCEPT_CONTEXT` met:

- `name` — van `project.json#concept.name` (kan leeg zijn)
- `pitch` — van `project.json#concept.pitch` (kan leeg zijn)
- `markdown` — volledige inhoud van `project-concept.md` (leeg als bestand niet bestaat)
- `present` — `true` als `markdown.length > 50` OF `pitch` niet-leeg

## Drempels

- **Aanwezig** (`present: true`): `markdown.length > 50` OF `pitch` niet-leeg
- **Bijna leeg** (scaffold-stub, paar woorden): behandel als afwezig
- **Legacy `concept.content`**: niet lezen — `thinking-concept` heeft dit veld weggemigreerd; lege fallback is correct gedrag

## Weighing suggestions

With every selection-style modal or `→ Claude recommends:` line when `CONCEPT_CONTEXT.present`:

- Onderbouw advies met concept-relevante reden
- Filter opties die duidelijk niet bij het concept-domein passen
- Stem defaults af op het domein (consumer SaaS, internal tool, mobile, game, etc.)

When `present: false`: omit concept reference in recommendation text.

## Writing

Forbidden for consumers. Only `/thinking-concept` writes to `project-concept.md` or
mutates `project.json#concept`. Additional session context (e.g. from user input) stays
in-memory as `CONCEPT_CONTEXT.markdown += extra` — never write back to disk.
