# Design Route — State Machine

Full state machine for `route-design.md`. Loaded on-demand for debugging or validation — the PHASE descriptions in `route-design.md` are the authoritative execution spec.

```
[*] → PREFLIGHT

PREFLIGHT → ARG_KNOWN (pass + argument matches existing entity)
PREFLIGHT → ARG_UNKNOWN (pass + argument given but unknown)
PREFLIGHT → ACTION_SELECT (pass + no argument)
PREFLIGHT → ERROR (fail)

ARG_KNOWN → BUILD (choice: Build)
ARG_KNOWN → BRIEF (choice: Brief)
ARG_KNOWN → PAGE_ROUTE (choice: Edit spec, PAGE entity)
ARG_KNOWN → COMPONENT (choice: Edit spec, COMPONENT entity)
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
BUILD_ENTITY → DESIGN_DIRECTION
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

Note: BUILD_ENTITY → DESIGN_DIRECTION → BUILD PLAN run in plan mode (entered after worktree setup, exited at the `ExitPlanMode` point in route-build.md Step 7). CREATE runs in plan mode per route-create.md.
