# Seed Alignment — Detection, Edit Contract, Approval

Loaded from PHASE 1 only when `SEED_CONTEXT.present`. This skill runs **outside plan mode** — under model routers (opusplan) that means a lighter model than `/project-seed` or `/project-plan` get for their seed rewrites. Everything below is therefore checklist-shaped with safe defaults, and the only permitted seed mutations are literal, pre-approved edits. Freeform section rewrites are never allowed here.

## Alignment scan (per queue item)

Judge the item's name + description against `SEED_CONTEXT.markdown` + `SEED_CONTEXT.pitch`. First match wins:

1. **Aligned (default)** — the item is semantically represented in the seed (same capability, even in other words), OR it refines an existing seed claim, OR its type is BUG, PERF, A11Y, THEME, or POLISH (quality work on existing scope is aligned by definition — unless rule 2 fires).
2. **Contradiction** — ONLY when you can quote one exact seed sentence, verbatim, that states the opposite of what the item does (seed: "client-only, no backend" — item adds an API route). No verbatim quote → not a contradiction, fall through.
3. **New direction** — the item introduces a major aspect absent from the seed that would force `seed.pitch` to change (new platform, audience, game mode, business model). Unsure whether the pitch would change → rule 4.
4. **Scope expansion** — a new capability or domain area the seed does not cover, overall direction unchanged.

**Verdict shape** per item: `aligned`, or `drift { category, entry, proposedEdit }`, or `drift { category, entry, record-only }`. The `entry` follows `shared/SEED.md § Drift entry schema` with `source: "/project-todo"`, `ref: "feature:{name}"`, and — for contradictions — the verbatim quote as `seedSays` (otherwise `"(no mention of {topic})"`).

## Safe-default ladder

- Unsure between aligned and any drift category → **aligned**.
- Sure it drifts, unsure which category → **scope-expansion**.
- Never guess a contradiction: no locatable verbatim sentence → it is not one.

## Surgical edit contract

A `proposedEdit` is one of exactly two forms — never a full-file rewrite, never reordering, never touching unaffected sections:

- **contradiction** → one targeted Edit: `old_string` = the verbatim seed sentence from rule 2, `new_string` = the corrected sentence. If the sentence cannot be found verbatim in the file → downgrade to record-only.
- **new-direction / scope-expansion** → append one bullet or a ≤2-sentence paragraph at the end of the best-matching existing `##` section. No section matches → append under `## Scope additions` (create at the end of the file if absent).

## Escape hatch → record-only

Skip the edit and record the drift entry instead when ANY of these holds:

- the drift would touch ≥3 seed sections, or fixing it requires restructuring/moving sections
- the queue produced >2 drift verdicts in this run
- gate criterion 2 (thin description) fired for that item — its description changes after the gate, so a pre-gate edit preview would be stale
- contradiction without a locatable verbatim sentence
- the seed question was dropped by the 4-question cap (see below)

The escape hatch always adds this line to the PHASE 3 output: recommend `/project-seed` → "Sync with project" — that route runs in plan mode and handles large drift properly.

## Seed update question

Bundled into the **same single** PHASE 1x `AskUserQuestion` call as the ambiguity-gate questions — never a second call. It is not a sixth gate criterion; the 4-question cap wins: if the gate already fills 4 slots, drop this question and downgrade all edits to record-only. Maximum one seed question per run; with multiple drift items, all proposed edits go into one preview (all-or-nothing — declining means record-only for all).

The `preview` field is mandatory: the user approves the literal diff, not an intention.

```yaml
header: "Seed update"
question: "New item(s) drift from the seed — apply this exact seed edit?"
options:
  - label: "Apply edit(s) (Recommended)"
    description: "{category}: targeted edit to project-seed.md, shown verbatim in the preview"
    preview: |
      - "{exact current seed sentence}"
      + "{exact replacement sentence}"

      ## {matched section} — append:
      + "{exact bullet/paragraph text}"
  - label: "Record for later sync"
    description: "Log as seedDrift[] for /project-seed → Sync (no seed change)"
multiSelect: false
```

Preview shows only the forms that apply (replacement diff, append block, or both). If the duplicate-gate answer removed an item ("Same — don't add"), its edit is void — re-check whether a seed question is still warranted before building the call.

## Write path (executed in PHASE 2 step 5)

- **Approved** → apply the previewed Edit(s) literally to `.project/project-seed.md`, then follow `shared/SEED.md § Write targets` with one deviation: the `project-seed.md` row is the targeted Edit above, never a full-file write. Pitch: targeted Edit only when the replaced sentence also appears in `project.json#seed.pitch`; `backlog.json#data.overview` co-update rides the same write pass as step 6. Append-form edits never touch pitch/overview. Log: `Seed: ✓ updated — {n} edit(s) applied`.
- **Declined / record-only** → append each `entry` to `backlog.json#data.seedDrift[]` in the step-6 write pass (initialize the array if absent). Log: `Seed: ⚠ drift recorded — {category}: {name}`.
- **Aligned** → log `Seed: ✓ aligned`.
