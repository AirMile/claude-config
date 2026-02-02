# 1-plan Skill Fixes - 2025-12-08

## Context

This document tracks fixes from `/test-skill 1-plan` analysis. Use this file to resume work if context is compacted.

## Issues to Fix

### Issue 4: Requirements Loop Limit
**Status:** ✅ FIXED
**Location:** FASE 2, lines 734-739
**Problem:** No max limit on add/remove/edit commands - user can loop indefinitely
**Fix:** Add max 10 modifications limit with proceed message

**Current text:**
```markdown
3. **Handle user feedback:**
   - If 'ok' → proceed to summary
   - If 'add: ...' → add new requirement with next REQ-ID, show updated list
   - If 'remove: REQ-XXX' → remove requirement, show updated list
   - If 'edit: REQ-XXX ...' → update requirement description, show updated list
   - Loop until user types 'ok'
```

**New text:**
```markdown
3. **Handle user feedback:**
   - If 'ok' → proceed to summary
   - If 'add: ...' → add new requirement with next REQ-ID, show updated list
   - If 'remove: REQ-XXX' → remove requirement, show updated list
   - If 'edit: REQ-XXX ...' → update requirement description, show updated list
   - Loop until user types 'ok'
   - **Max 10 modifications:** After 10 add/remove/edit commands, show:
     ```
     Max modifications reached (10). Proceeding with current requirements.
     Type 'ok' to continue or 'cancel' to stop.
     ```
```

---

### Issue 5: Step Reference Error
**Status:** NOT AN ISSUE (after review)
**Reason:** "Proceed to step 3" from step 2 is correct - step 3 is "Summarize and confirm"

---

### Issue 6: Script Reference
**Status:** NOT AN ISSUE (after review)
**Reason:** Two different scripts serve different purposes:
- `generate_context_block.py` (FASE 4): Creates intermediate context for /analyze
- `generate_output.py` (FASE 6): Creates final output files

Both are correctly referenced in their respective phases.

---

### Issue 7: Checkpoint Capitalization
**Status:** ✅ FIXED
**Problem:** Inconsistent capitalization: "checkpoint 1", "Checkpoint 1", "CHECKPOINT 1"
**Fix:** Standardize all to "CHECKPOINT X" format

**Lines to change:**
| Line | Current | New |
|------|---------|-----|
| 799 | `**Checkpoint 1 Input Handling:**` | `**CHECKPOINT 1 Input Handling:**` |
| 1331 | `**Checkpoint 2 Input Handling:**` | `**CHECKPOINT 2 Input Handling:**` |
| 2288 | `### Checkpoint Discipline` | `### CHECKPOINT Discipline` |
| 2289 | `Checkpoint 1 (after FASE 2)` | `CHECKPOINT 1 (after FASE 2)` |
| 2290 | `Checkpoint 2 (after FASE 3.5)` | `CHECKPOINT 2 (after FASE 3.5)` |
| 2291 | `after Checkpoint 1` | `after CHECKPOINT 1` |
| 2293 | `without Checkpoint 1` | `without CHECKPOINT 1` |
| 2294 | `without Checkpoint 2` | `without CHECKPOINT 2` |
| 2307 | `Skip checkpoint 1` | `Skip CHECKPOINT 1` |
| 2308 | `Skip checkpoint 2` | `Skip CHECKPOINT 2` |
| 2336 | `at checkpoint 1` | `at CHECKPOINT 1` |
| 2343 | `at checkpoint 2` | `at CHECKPOINT 2` |

---

## Summary

| Issue | Status | Action |
|-------|--------|--------|
| 4 - Requirements loop limit | ✅ FIXED | Added max 10 limit with proceed message |
| 5 - Step reference error | SKIP | Not an issue after review |
| 6 - Script reference | SKIP | Not an issue after review |
| 7 - Checkpoint capitalization | ✅ FIXED | Standardized 10 occurrences |

## Applied Fixes

### Fix 4: Requirements Loop Limit
Added to FASE 2 "Handle user feedback" section (lines 740-744):
```markdown
- **Max 10 modifications:** After 10 add/remove/edit commands, show:
  ```
  Max modifications reached (10). Proceeding with current requirements.
  Type 'ok' to continue or 'cancel' to stop.
  ```
```

### Fix 7: Checkpoint Capitalization
Changed 10 occurrences from `Checkpoint X` or `checkpoint X` to `CHECKPOINT X`:
- Line 804: CHECKPOINT 1 Input Handling
- Line 1336: CHECKPOINT 2 Input Handling
- Line 2293: CHECKPOINT Discipline (section header)
- Line 2294: CHECKPOINT 1 (after FASE 2)
- Line 2295: CHECKPOINT 2 (after FASE 3.5)
- Line 2296: after CHECKPOINT 1
- Line 2298: without CHECKPOINT 1
- Line 2299: without CHECKPOINT 2
- Line 2312: Skip CHECKPOINT 1
- Line 2313: Skip CHECKPOINT 2
- Line 2341: at CHECKPOINT 1
- Line 2348: at CHECKPOINT 2

## Resume Instructions

All requested fixes have been applied. No remaining work.
