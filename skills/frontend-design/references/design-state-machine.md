# Design Route — State Machine

Full state machine for `route-design.md`. Loaded on-demand for debugging or validation — the PHASE descriptions in `route-design.md` are the authoritative execution spec.

```
[*] → PREFLIGHT

PREFLIGHT → ARG_KNOWN (pass + argument matches existing entity)
PREFLIGHT → ARG_UNKNOWN (pass + argument given but unknown)
PREFLIGHT → ACTION_SELECT (pass + no argument)
PREFLIGHT → ERROR (fail)

ARG_KNOWN → BUILD (choice: Build — its Step 2.5 gate absorbs spec edit + save-spec-only)
ARG_KNOWN → BRIEF (choice: Brief)
ARG_KNOWN → CREATE (choice: Capture as new)
ARG_KNOWN → CONVERT (choice: Convert from sketch/mockup)

ARG_UNKNOWN → PAGE_ROUTE (choice: New page)
ARG_UNKNOWN → COMPONENT (choice: New component)
ARG_UNKNOWN → [*] (choice: Cancel)

ACTION_SELECT → CREATE (empty state)
ACTION_SELECT → IMPORT (empty state)
ACTION_SELECT → BUILD (populated + ≥1 PAGE or COMPONENT DEF without visuals)
ACTION_SELECT → VIEW (populated)
ACTION_SELECT → PAGE_ROUTE (populated)
ACTION_SELECT → COMPONENT (populated)
ACTION_SELECT → FLOW (populated)
ACTION_SELECT → PRINCIPLES (populated)
ACTION_SELECT → DELETE (populated)
ACTION_SELECT → RESTORE (populated, history exists)
ACTION_SELECT → CONVERT (populated, via "Other")

CREATE → POSTFLIGHT (plan approval counts as confirm — Create runs in plan mode, see route-create.md)
IMPORT → CONFIRM
BUILD → BUILD_ENTITY (choose PAGE or COMPONENT)
BUILD_ENTITY → SPEC_GATE (Step 2.5 — resolve + show spec, before worktree)
SPEC_GATE → SPEC_GATE (choice: Edit spec — route-page/route-component field edit, loop back)
SPEC_GATE → CONFIRM (choice: Save spec only — hands to PHASE 3 → PHASE X, no worktree/codegen)
SPEC_GATE → DESIGN_DIRECTION (choice: Build it — worktree + plan mode, then directions)
DESIGN_DIRECTION → ALTERNATIVES_SELECT (≥2 variants or sections)
DESIGN_DIRECTION → BUILD_CODE (single-variant / stateless — skip alternatives)
ALTERNATIVES_SELECT → BUILD_CODE (layout chosen)
BUILD_CODE → BUILD_SMOKE (post-write checks pass)
BUILD_CODE → ACTION_SELECT (post-write check failed → "Fix manually")
BUILD_SMOKE → BUILD_VERIFY (smoke pass/skip/fail — non-blocking)
BUILD_VERIFY → BUILD_COMPLETE ($VERIFY_STATUS = PASS or SKIPPED)
BUILD_VERIFY → ACTION_SELECT ($VERIFY_STATUS = FAIL → "Fix manually")
VIEW → ACTION_SELECT ("Edit")
VIEW → [*] ("Done")
PAGE_ROUTE → CONFIRM
COMPONENT → CONFIRM
FLOW → CONFIRM
PRINCIPLES → CONFIRM
DELETE → CONFIRM
RESTORE → POSTFLIGHT ("Yes" — skip X.0)
RESTORE → [*] ("Cancel")

CONVERT → ROUTE_CONVERT_FILE

CONFIRM → POSTFLIGHT ("Yes")
CONFIRM → ACTION_SELECT ("Edit" — loop back)
CONFIRM → [*] ("Cancel")

POSTFLIGHT → COMPLETE (pass)
POSTFLIGHT → RECOVER (fail)

BUILD_COMPLETE → [*]
COMPLETE → [*]
```

Note: plan-mode boundaries (the `opusplan` thinking hint — see `shared/PLAN-MODE.md`):

- **Synthesis routes** PAGE_ROUTE / COMPONENT / FLOW / PRINCIPLES / IMPORT / BRIEF enter plan mode at the **PHASE 1.5 gate** (conditional entry, after ACTION_SELECT). They exit at CONFIRM — `ExitPlanMode` = the "Apply changes?" approval — except BRIEF, which has no CONFIRM and exits at its own Step 5 write boundary (the `.md` brief is the plan output).
- **CRUD** VIEW / DELETE / RESTORE run outside plan mode (friction-free).
- **BUILD** self-manages: plan mode is entered at the start of route-build.md (Step 0b) so entity/candidate/spec decisions (Steps 1–2.5), DESIGN_DIRECTION and BUILD PLAN all run on the planning model. Exit is the `ExitPlanMode` at route-build.md Step 7, after which the worktree is created (Step 7b) and codegen runs. The Step 2.5 "save spec only" off-ramp exits plan mode at its own boundary (the spec is the plan output) before writing.
- **CREATE** self-manages: runs in plan mode per route-create.md.

If the skill was started in plan mode by the user, the PHASE 1.5 entry and the CONFIRM/Step 5 `ExitPlanMode` are skipped — the user ends plan mode themselves.
