# PHASE 3: Fix Loop

Load this file when entering PHASE 3. Contains the full fix process for TESTABLE and MEASURABLE issues.

---

**Goal:** Fix all issues using appropriate method for each type.

**Process for each issue (in order):**

## For TESTABLE Issues: TDD Fix Loop

### Step 0: Assess Fix Complexity

Before fixing, determine if research is needed:

| Complexity | Example                         | Research? |
| ---------- | ------------------------------- | --------- |
| Simple     | Change a number value           | No        |
| Medium     | Add new property/method         | No        |
| Complex    | Refactor signal flow, add state | Yes       |

**Complexity indicators:**

```
SIMPLE (no research):
- "puddle radius 50 -> 100"       -> Just change the value
- "damage too low"                -> Just increase the value
- "missing sound"                 -> Just add AudioStreamPlayer
- "animation speed wrong"         -> Just adjust the speed

COMPLEX (offer research):
- "ability doesn't chain correctly"    -> Signal flow issue
- "state machine not transitioning"    -> State logic issue
- "cooldown resets unexpectedly"       -> Timer/state interaction
- "collision not detecting properly"   -> Physics layer issue
- "node references breaking"           -> Scene tree / lifecycle issue
```

**If complex fix detected:**

Use AskUserQuestion tool:

- header: "Research"
- question: "This is a complex fix ({brief issue description}). Do you want to research Godot patterns?"
- options:
  - label: "Yes, research (Recommended)", description: "Research best approach"
  - label: "No, fix directly", description: "Fix without research"
- multiSelect: false

**If research requested:**

```
Task(subagent_type="godot-code-researcher", prompt="
Feature: {feature-name}
Fix needed: {description of issue}

Current code:
{relevant code snippet}

Problem: {what's wrong}
Goal: {what should happen}

Research GDScript patterns for this fix.
")
```

Use research findings to inform the fix implementation below.

### Steps 1–5: TDD Fix (potentially informed by research)

1. **Generate test based on feedback:**

   ```
   GENERATING TEST for item {N}

   Issue: {description}
   Expected: {concrete value from feedback}
   ```

2. **Write test file:**

   ```gdscript
   # tests/test_{feature}_{item}.gd
   extends GutTest

   func test_{specific_behavior}() -> void:
       # Arrange
       var {object} = {setup}

       # Act
       var result = {action}

       # Assert
       assert_eq(result, {expected_value}, "{description}")
   ```

3. **Run test (expect FAIL):**

   ```bash
   "{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}_{item}.gd
   ```

   **If test PASSES (unexpected):**

   ```
   UNEXPECTED: Test already passes

   The test passes with current code.
   Possible causes:
   - Issue was already fixed
   - Test doesn't capture the real problem
   - Feedback was based on old version
   ```

   Use AskUserQuestion tool:
   - header: "Test Passed"
   - question: "The test already passes. What do you want to do?"
   - options:
     - label: "Skip (Recommended)", description: "Item appears already fixed, move to next"
     - label: "Adjust test", description: "The test is incorrect, I will provide new values"
     - label: "Check manually", description: "Stop and check this manually"
   - multiSelect: false

   **If test FAILS (expected):**

   ```
   TEST FAILS (expected)

   Test: test_{specific_behavior}
   Expected: {expected_value}
   Actual: {actual_value}

   -> Implementing fix...
   ```

4. **Implement fix:**
   - Locate relevant code
   - Make minimal change to satisfy test
   - Document what was changed

5. **Run test again (expect PASS):**

   ```
   TEST PASSES

   Item {N} fixed via TDD.
   Change: {description of fix}
   File: {file:line}
   ```

6. **If test still fails after fix:**
   - Analyze why
   - Try alternative approach
   - Max 3 attempts before asking user

---

## For MEASURABLE Issues: Direct Fix

1. **Identify code location:**

   ```
   DIRECT FIX for item {N}

   Issue: {description}
   Location: {file:line}
   Current value: {current}
   ```

2. **Apply fix directly:**
   - Adjust value/property
   - No test possible (subjective/feel)
   - Document the change

3. **Result:**

   ```
   FIXED (cannot auto-verify)

   Change: {what was changed}
   From: {old value}
   To: {new value}
   File: {file:line}

   Needs manual re-test.
   ```

---

## After All Issues Processed

```
FIX LOOP COMPLETE

| # | Type | Status | Change |
|---|------|--------|--------|
| 3 | TESTABLE | FIXED (test passes) | Puddle radius 50->100 |
| 4 | MEASURABLE | FIXED (needs re-test) | Added cast sound |

New tests added: 1
Files modified: 2

-> Generating re-test checklist...
```
