# PHASE 4: Manual Test Execution

Load this file when entering PHASE 4. Contains the interactive manual test loop.

---

Show setup instructions once, then loop through each MANUAL item:

```
TEST SETUP: {feature-name}
Open {tunnel_url}
```

**For each MANUAL item:**

```
──────────────────────────────────────
MANUAL TEST {n}/{total_manual}: {item title}
──────────────────────────────────────

STEPS:
1. {concrete action, e.g. "Go to /register"}
2. {concrete action with data, e.g. "Enter: Email → test@example.com"}
3. {concrete action, e.g. "Click 'Register'"}

TEST DATA:
┌─────────────┬──────────────────────┐
│ Field       │ Value                │
├─────────────┼──────────────────────┤
│ Name        │ Test User            │
│ Email       │ test@example.com     │
└─────────────┴──────────────────────┘

EXPECTED:
→ {exact expected outcome}

REQUIREMENT: {REQ-ID}: {description}
```

Use AskUserQuestion per item:

- header: "Test {n}/{total_manual}"
- question: "Result for '{item title}'?"
- options:
  - label: "Pass (Recommended)", description: "Works as expected"
  - label: "Fail", description: "Does not work — I will provide details"
  - label: "Skip", description: "Cannot test, skip"
- multiSelect: false

**If Pass** → record PASS, next item.
**If Fail** → ask for brief details (what happened instead?), record FAIL + notes, next item.
**If Skip** → record SKIP, next item.
