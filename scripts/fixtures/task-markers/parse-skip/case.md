# fixture-parse-skip

Test fixture for check-task-markers.py: an affirmative `TaskCreate` seed line
with no numbered phase list anywhere near it → PARSE-SKIP (non-fatal), plus a
negated mention and a fenced example that must both be ignored entirely.

First action: call `TaskCreate` to track your progress as you see fit.

Workers must NOT call `TaskCreate` — the main chat owns the task list.

```markdown
**Phase tracking** — first action of the skill: call `TaskCreate` with these 2 items

1. PHASE 0: Fenced example, not a real seed
2. PHASE 1: Ignored
```
