# Seed Reader Protocol

How a skill reads seed context. Consumer skills reference this instead of repeating it inline.

**Owner:** `/project-seed` writes freely; `/dev-ship (define phase)`, `/game-ship (define phase)`, and
`/project-plan` may rewrite affected sections after their Seed Alignment
Check with explicit user approval. All other skills are read-only consumers.

---

## Reader (execution)

Run this once at the start of the relevant phase:

1. Read `.project/project-seed.md` if it exists → `md_content`
2. Read `.project/project.json#seed` → extract `name`, `pitch`

Output: `SEED_CONTEXT` with:

- `name` — from `project.json#seed.name` (can be empty)
- `pitch` — from `project.json#seed.pitch` (can be empty)
- `markdown` — full contents of `project-seed.md` (empty if file does not exist)
- `present` — `true` if `markdown.length > 50` OR `pitch` is non-empty

## Thresholds

- **Present** (`present: true`): `markdown.length > 50` OR `pitch` is non-empty
- **Nearly empty** (scaffold-stub, a few words): treat as absent
- **Legacy `concept.content`**: do not read — `project-seed` has migrated this field away; empty fallback is correct behavior

## Weighing suggestions

With every selection-style modal or `→ Claude recommends:` line when `SEED_CONTEXT.present`:

- Back up advice with a concept-relevant reason
- Filter options that clearly do not fit the concept domain
- Align defaults to the domain (consumer SaaS, internal tool, mobile, game, etc.)

When `present: false`: omit concept reference in recommendation text.

## Writing

`/project-seed` is the primary owner — full rewrites and gap-syncs.

`/dev-ship (define phase)`, `/game-ship (define phase)`, and `/project-plan` may mutate
`project-seed.md`, each only under both conditions:

1. The Seed Alignment Check (see `## Alignment Check` below) detected drift, AND
2. The user explicitly approved the inline rewrite via the AskUserQuestion
   prompt (and plan-mode approval where the skill uses plan mode).

All other skills remain read-only consumers. Additional session context
(e.g. from user input) stays in-memory as `SEED_CONTEXT.markdown += extra`
— never write back to disk.

---

## Alignment Check (consumer protocol)

When a skill makes decisions that may redirect the project away from the seed
concept, run this check at the designated alignment point for that skill.

### Skip condition

`SEED_CONTEXT.present` is `false` → log nothing, continue.

### Drift scan

Compare the decisions made in this skill (requirements, architecture, backlog
reshuffles, priority changes) against `SEED_CONTEXT.markdown` + `SEED_CONTEXT.pitch`.
Flag only semantically significant drift:

- **New direction** — major aspect absent from the seed (e.g. seed says "single-player", decisions add multiplayer)
- **Contradiction** — decision conflicts with an explicit seed statement (e.g. seed says "client-only", architecture introduces a backend route)
- **Scope expansion** — entirely new domain area the seed does not cover

Skip cosmetic drift: wording differences, refinements of existing seed claims, internal refactors.

### Reporting

**No drift:** log `Seed: ✓ aligned` (one line inline), continue.

**Drift detected:** log `Seed: ⚠ drift — N item(s)` inline. Write the drift
table to the plan file (or inline in chat if the skill is not in plan mode):

| #   | Category      | Seed says                 | This decision adds/changes    |
| --- | ------------- | ------------------------- | ----------------------------- |
| 1   | Contradiction | "client-only, no backend" | adds POST /api/sync (REQ-003) |
| 2   | New direction | (no mention of collab)    | introduces shared workspaces  |

### Resolution prompt

```yaml
header: "Seed update"
question: "Update project-seed.md to reflect this direction?"
options:
  - label: "Yes, update seed (Recommended)", description: "Inline rewrite — affected sections revised to match; full proposal reviewed before write"
  - label: "Skip — leave seed as-is", description: "Drift logged in skill artifact for later /project-seed sync"
  - label: "Adjust the proposed changes", description: "Tweak the rewrite before applying"
multiSelect: false
```

### Resolution outcomes

- **Yes** → generate inline rewrite of `project-seed.md` (preserve unaffected sections verbatim, rewrite only drifted sections); derive updated `seed.pitch` (1–2 sentences) if stale. In plan-mode skills: append proposed full file to plan file under `## Proposed seed update` heading for review. Carry `seedUpdateApproved: true` to sync phase. **The sync phase MUST also co-update `backlog.json#data.overview` whenever `seed.pitch` changed** — same source of truth, two surfaces. See [§ Write targets](#write-targets-sync-phase) for the canonical mutation set.
- **Skip** → record drift items as `seedDrift[]` (each entry per the schema below) and persist in the skill's primary artifact (`feature.json#seedDrift[]` or `backlog.json#data.seedDrift[]`). Picked up later by `/project-seed § Sync`, `/project-brainstorm` (concept-scope save), or `/project-critique` (concept-scope save) — first one to successfully rewrite the seed clears the matching entries. Carry `seedUpdateApproved: false`.
- **Adjust** → loop on item selection, regenerate rewrite, re-prompt.

### Drift entry schema

```json
{
  "category": "contradiction|new-direction|scope-expansion",
  "seedSays": "<short quote or summary>",
  "featureDecides": "<what changed>",
  "source": "/dev-ship (define phase)|/game-ship (define phase)|/project-plan|/project-todo",
  "ref": "REQ-003|feature:auth-login|null",
  "detectedAt": "<ISO timestamp>"
}
```

### Designated alignment points

| Skill                       | Alignment point                                                     | Plan mode? |
| --------------------------- | ------------------------------------------------------------------- | ---------- |
| `/dev-ship (define phase)`  | End of PHASE 2 Architecture, before ExitPlanMode                    | Yes        |
| `/game-ship (define phase)` | End of PHASE 3 Architecture Design, before ExitPlanMode             | Yes        |
| `/project-plan`             | After PHASE 3 Priority Assignment confirmation, before ExitPlanMode | Yes        |

---

## Write targets (sync phase)

When `seedUpdateApproved: true` reaches the consumer skill's sync phase, the following writes happen as one parallel batch:

| Target                       | When                                      | How                                                                                                         |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `.project/project-seed.md`   | Always (full rewrite of approved content) | Write full file                                                                                             |
| `project.json#seed.pitch`    | If pitch differs from previous            | Targeted Edit                                                                                               |
| `project.json#seed.name`     | Only if H1 title in rewrite changed       | Targeted Edit                                                                                               |
| `backlog.json#data.overview` | If `seed.pitch` changed                   | Replace with new pitch (or first 1–2 sentences if pitch > ~200 chars). Skip silently when already matching. |

Log line (consumer skill): `Seed: ✓ updated — N section(s) rewritten` (append ` + backlog.overview` when overview was co-updated).

Consumer skills do not duplicate these mutation details — reference this table.
