# fixture-mismatch

Test fixture for check-task-markers.py: seeded PHASE 2 has no header and is
never marked `completed` (completion marker missing), and PHASE 1 is wrapped
across quoted lines (must still match after normalization).

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 3 items
(status `pending`).

1. PHASE 0: Setup
2. PHASE 1: Build
3. PHASE 2: Report

### PHASE 0: Setup

> **Todo**: call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0 → `in_progress`.

### PHASE 1: Build

> **Todo**: mark PHASE 0 → `completed`, then flip
> PHASE 1 → `in_progress`.

Build body. PHASE 2 gets `in_progress` below but never `completed`, and its
header is missing entirely.

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.
