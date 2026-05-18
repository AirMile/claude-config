# PHASE 6: Teammate Feedback

Load this file when generating feedback in PHASE 6. Skip if BRANCH_ONLY mode.

---

Generate structured feedback based on test results, completeness check, and any fixes applied.

**Feature Readiness Verdict (always include):**

- `READY` — ≥90% requirements/scenarios pass + 0 CRITICAL failures
- `NOT READY` — otherwise (including reason)

**If all PASS (or all fixed):**

```
FEEDBACK FOR {externalRef.assignees[0] ?? "teammate"}

Feature: {feature-name}
Status: ✓ All PASS

✓ What works:
{list of passing requirements/expectations with brief evidence}

{If fixes were applied:}
Fixes applied:
{numbered list of fixes with file:line references}

Ready to merge.
```

**If FAIL or MISSING items remain:**

```
FEEDBACK FOR {externalRef.assignees[0] ?? "teammate"}

Feature: {feature-name}
Status: {pass}/{total} PASS

✓ What works:
{list of passing requirements with brief evidence}

✗ Issues:
{numbered list of failing/missing items with specific details:}
1. {REQ-ID} ({description}): {what's wrong or missing}
   Expected: {acceptance criteria}
   Found: {what was found, or "not implemented"}

{If some items were fixed:}
✓ Already fixed:
{list of fixes applied with file:line references}

Next step: {concrete action items for remaining issues}
```

Use AskUserQuestion:

- header: "Feedback"
- question: "Feedback for {externalRef.assignees[0] ?? 'teammate'} generated. What do you want to do with it?"
- options:
  - label: "Save as file (Recommended)", description: "Save to .project/features/{feature}/feedback.md"
  - label: "Show in chat", description: "Print feedback in conversation (copy manually)"
  - label: "Skip", description: "No action"
- multiSelect: false
