# Technique: Implementation First

## Variants

- **Implementation First** (default): implement, then test
- **Implementation Only**: implement without automated tests. Only when there is a clear reason (see below).

## Single Requirement Workflow

### Step 1: Implement

Implement THIS requirement fully. Context7 research if needed.
Verify it works (manual check or quick run).

### Step 2: Write Test

Generate test for the implemented requirement.
Run test — fix implementation if FAIL.

**Skip for Implementation Only** — go directly to output.

### Output

**Implementation First:**

```
REQ-XXX: {description}
IMPLEMENTED: {what was built}
TESTED: PASS
Files: {files created/modified}
SYNC:  {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

**Implementation Only:**

```
REQ-XXX: {description}
IMPLEMENTED: {what was built}
TESTED: SKIPPED ({reason})
Files: {files created/modified}
SYNC:  {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

## Implementation Only: Allowed Reasons

Use only when automated tests add no value:

| Reason        | When                                                        |
| ------------- | ----------------------------------------------------------- |
| `visual-only` | Pure styling, layout, CSS, visual effects, particles        |
| `config-only` | Env vars, route registration, package config, static assets |
| `prototype`   | Deliberately temporary code, throwaway MVP                  |

The requirement still gets a manual checklist item in `tests.checklist[]` (PHASE 3B).
The reason is logged in `feature.json` per requirement as `skipTestReason`.
