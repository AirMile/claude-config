# Game Verify — Checklist Classification (PHASE 0, step 6)

Classify playtest checklist items, run the CATEGORY-GAP check, and build the goal-backward acceptance mapping. Outcome: classified checklist (COVERED/MANUAL) + acceptance-mapping table — input for the playtest phases.

---

## a. Classify checklist items

- Use `checklist[]` from the FEATURE-LOAD output
- Note expected behavior for each item (from `title` field)
- Count total items
- **Classify each item:**
  - **COVERED**: GUT unit tests from `/game-build` already verify this requirement. Check `tests/test_{feature}.gd` for matching test functions. COVERED items are already verified — skip in playtest.
  - **MANUAL**: Requires human verification (gameplay feel, visuals, audio, game launch). Everything that is not COVERED.
- Display classification:

```
CHECKLIST CLASSIFICATION:

COVERED ({N} items — skip, already verified by GUT tests):
- Item {X}: {description} → test_{function}()

MANUAL ({M} items — playtest required):
- Item {Y}: {description}
```

If all items are COVERED → skip playtest, go to PHASE 6 completion.

## b. Goal-backward verification — map tests back to acceptance criteria

**CATEGORY-GAP check** (mechanically determined from feature.json — run first):

- Set A = `{ (REQ.id, entry.category ?? "happy") | for each REQ (non-REMOVED), for each entry in REQ.acceptance[] }`
- Set B = `{ (item.requirementId, item.category ?? "happy") | for each item in tests.checklist[] }`
- CATEGORY-GAPs = A \ B (combinations defined by game-define but not written by game-build)
- Per gap: add as a MANUAL playtest item with title `"{category} coverage missing for {REQ.id}"` and steps/expected from the matching `acceptance[]` entry's `{ when, then }`.

Filter: skip requirements with `deltaOp === "REMOVED"` — do not include in the mapping.

## c. Build acceptance mapping

Build mapping from feature.json `requirements[].acceptance` (`[{ when, then }]` objects) and classified items. Each `{ when, then }` scenario = one row:

| REQ   | When                    | Then (expected)      | Test Items | Coverage |
| ----- | ----------------------- | -------------------- | ---------- | -------- |
| REQ-1 | enemy hit by attack     | enemy takes damage   | Item 1, 3  | ✓        |
| REQ-2 | critical hit registered | knockback is applied | —          | GAP      |

**GAP**: requirement without test items (COVERED or MANUAL).
**CATEGORY-GAP**: acceptance scenario with a specific `category` (edge/boundary) that no checklist item covers — show in table with label `(category-coverage)`.
**MISMATCH**: test items that verify implementation details instead of observable gameplay (test title references internal functions instead of player-visible behavior).

## d. Resolve gaps

No gaps, no mismatches → show `Acceptance mapping: {n}/{n} REQs covered` and continue.

Gaps or mismatches → AskUserQuestion:

- "Accept and continue (Recommended)" — note it, proceed
- "Adjust test items" — add items for gaps, reformulate mismatches
