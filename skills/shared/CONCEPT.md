# Concept Reader Protocol

How a skill reads concept context. Consumer skills reference this instead of repeating it inline.

**Owner:** `/thinking-concept` is the only skill that mutates `project-concept.md`.
All other skills are read-only consumers.

---

## Reader (execution)

Run this once at the start of the relevant phase:

1. Read `.project/project-concept.md` if it exists → `md_content`
2. Read `.project/project.json#concept` → extract `name`, `pitch`

Output: `CONCEPT_CONTEXT` with:

- `name` — from `project.json#concept.name` (can be empty)
- `pitch` — from `project.json#concept.pitch` (can be empty)
- `markdown` — full contents of `project-concept.md` (empty if file does not exist)
- `present` — `true` if `markdown.length > 50` OR `pitch` is non-empty

## Thresholds

- **Present** (`present: true`): `markdown.length > 50` OR `pitch` is non-empty
- **Nearly empty** (scaffold-stub, a few words): treat as absent
- **Legacy `concept.content`**: do not read — `thinking-concept` has migrated this field away; empty fallback is correct behavior

## Weighing suggestions

With every selection-style modal or `→ Claude recommends:` line when `CONCEPT_CONTEXT.present`:

- Back up advice with a concept-relevant reason
- Filter options that clearly do not fit the concept domain
- Align defaults to the domain (consumer SaaS, internal tool, mobile, game, etc.)

When `present: false`: omit concept reference in recommendation text.

## Writing

Forbidden for consumers. Only `/thinking-concept` writes to `project-concept.md` or
mutates `project.json#concept`. Additional session context (e.g. from user input) stays
in-memory as `CONCEPT_CONTEXT.markdown += extra` — never write back to disk.
