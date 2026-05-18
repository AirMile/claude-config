# PHASE 5c: Fix Loop

Load this file when entering PHASE 5c (user chose "Fix myself" or "Both"). Contains the full fix-iterate-retest flow.

---

For each FAIL item, analyze and fix:

1. **Analyze root cause** — read relevant source files, understand what's wrong
2. **Apply fix** — edit the code directly
3. **Verify** — run the relevant test (AUTO items: re-run via Task agent or CLI, MANUAL items: ask user to re-check)

After each fix:

```
[FIX] Item {N}: {title} [{REQ-ID}]
Root cause: {what was wrong, file:line}
Fix: {what was changed and why}
Impact: {what this affects}
```

**Re-test after all fixes:**

- AUTO items that were fixed → re-run via Task agent (same approach as PHASE 3)
- MANUAL items that were fixed → guided re-test (same approach as PHASE 4)

Display re-test results:

```
RE-TEST RESULTS: {feature-name}

| # | Test              | Type   | Requirement | Result |
|---|-------------------|--------|-------------|-----------|
| 2 | Without email     | AUTO   | REQ-002     | ✓ PASS   |
| 3 | Welcome mail      | MANUAL | REQ-004     | ✓ PASS   |

RE-TEST PASS: {n}  RE-TEST FAIL: {n}
```

**If items still failing after fix attempt:**

Use AskUserQuestion:

- header: "Fix Failed"
- question: "Item {N} still does not work after fix. What do you want to do?"
- options:
  - label: "Try again (Recommended)", description: "Try a different fix strategy"
  - label: "Send feedback", description: "Send as feedback to teammate"
  - label: "Accept", description: "Mark as known issue"
- multiSelect: false

Max 3 fix attempts per item before forcing fallback to feedback.

After fix loop completes → proceed to PHASE 5d.
