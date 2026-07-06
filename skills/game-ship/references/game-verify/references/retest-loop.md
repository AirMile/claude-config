# PHASE 4: Generate Re-test Checklist

**Goal:** Create minimal checklist for only the fixed items.

## Steps

1. **Filter to fixed items only:**
   - Skip items that passed in original feedback
   - Include only items that were fixed

2. **Generate re-test checklist:**

   ```
   RE-TEST REQUIRED

   The following items were fixed and need verification:

   | # | Test | Change Made |
   |---|------|-------------|
   | 3 | Puddle size | Now 100px (was 50px) |
   | 4 | Sound on cast | Added AudioStreamPlayer |

   Play the game and verify these specific items.

   Feedback format:
   3:PASS
   4:PASS

   Or if still failing:
   3:FAIL still too small
   4:PASS
   ```

3. **Wait for re-test feedback**

## Output

```
AWAITING RE-TEST

Fixed items: {count}
Provide feedback when ready.
```

---

# PHASE 5: Re-test Loop

**Goal:** Process re-test feedback and loop until all pass.

## Steps

1. **Parse re-test feedback:**
   - Same parsing as PHASE 1
   - Only expect results for fixed items

2. **Evaluate results:**

   **If all re-tests PASS:**
   -> Continue to PHASE 5c (Regression Check)

   **If any re-tests FAIL:**

   ```
   RE-TEST RESULTS

   | # | Status | Notes |
   |---|--------|-------|
   | 3 | FAIL | still too small |
   | 4 | PASS | - |

   1 item still failing.
   ```

3. **Handle persistent failures:**

   Use AskUserQuestion tool:
   - header: "Item {N} Still Failing"
   - question: "Item {N} still does not work after the fix. What do you want to do?"
   - options:
     - label: "Provide more details (Recommended)", description: "I will give more specific feedback"
     - label: "Different approach", description: "Try a different fix strategy"
     - label: "Accept as-is", description: "Mark as acceptable for now"
     - label: "Fix manually", description: "Stop and fix it yourself"
   - multiSelect: false

4. **Loop back to PHASE 2:**
   - Re-categorize new feedback
   - Apply new fixes
   - Generate new re-test checklist
   - Continue until all pass or user exits
