# fixture-conformant

Test fixture for check-task-markers.py: a minimal conformant tracking unit.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 3 items
(status `pending`), then use `TaskUpdate` per phase.

1. PHASE 0: Setup
2. PHASE 1: Build
3. PHASE 2: Report

### PHASE 0: Setup

> **Todo**: call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

Setup body.

### PHASE 1: Build

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

Build body.

### PHASE 2: Report

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Report body.

> **Todo**: mark PHASE 2 → `completed`.
