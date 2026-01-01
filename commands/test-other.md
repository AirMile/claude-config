---
description: Test teammate's code on feature branch after review
---

# Test Other Skill

## Overview

Testing skill for feature branches after code review. Analyzes all commits since branch creation, spawns parallel research agents for test strategies via Context7 with sequential thinking (with caching), then spawns generation agents with sequential thinking to create test scenarios. Uses sequential thinking to split tests into automated vs manual. Executes automated tests first, then guides user through manual test execution step-by-step.

**Trigger**: `/test-other` (typically after `/review-other`)

## When to Use

Activate this skill after code review of teammate's code needs testing.

**Primary trigger:**
- `/test-other` command after `/review-other` completed
- When feature branch code from teammate needs verification

**Context indicators:**
- On feature branch (not main/master/develop)
- Code review completed
- Changes ready for testing before merge

**NOT for:**
- Testing own code (use `/verify`)
- Main/develop branch
- Code without prior review

## Workflow

### FASE 0: BRANCH DETECTION & VALIDATION

1. Get current branch: `git branch --show-current`
2. Validate not on main/master/develop - if so, stop with error message
3. Find parent branch via merge-base: `git merge-base HEAD develop` (fallback to main/master)
4. Get all commits since branch creation: `git log <merge-base>..HEAD --oneline`
5. Get full diff: `git diff <merge-base>..HEAD`
6. Identify languages/frameworks in changed files

**Output:**
```
📋 BRANCH ANALYSIS

Branch: feature/xyz
Commits: X commits since develop
Files changed: Y files
Languages: [detected languages/frameworks]

**Confirm:** Doorgaan met test generatie?

options:
  - label: "Ja, genereer tests (Recommended)", description: "Start research en genereer test scenarios"
  - label: "Nee, annuleer", description: "Stop het test proces"
  - label: "Uitleg", description: "Leg uit wat er gaat gebeuren"
multiSelect: false
```

---

### FASE 1: RESEARCH VIA AGENTS (parallel)

**Goal:** Research test strategies via Context7, check cache first.

1. Read `references/research-cache.md` for existing research
2. Spawn 3 parallel research agents:

```python
Task(subagent_type="test-research-unit", prompt="""
Use sequential thinking to plan research.
Check cache for: [frameworks]
Research unit test strategies via Context7.
Return findings + what to cache.
""")

Task(subagent_type="test-research-integration", prompt="""
Use sequential thinking to plan research.
Check cache for: [frameworks]
Research integration test strategies via Context7.
Return findings + what to cache.
""")

Task(subagent_type="test-research-manual", prompt="""
Use sequential thinking to plan research.
Check cache for: [frameworks]
Research manual test strategies via Context7.
Return findings + what to cache.
""")
```

3. Collect results from all agents
4. Append new findings to `references/research-cache.md`

**Output:**
```
🔍 RESEARCH COMPLETE

Unit strategies: [summary]
Integration strategies: [summary]
Manual strategies: [summary]

Cache updated: [yes/no - X new entries]
```

---

### FASE 2: SCENARIO GENERATION (parallel)

**Goal:** Generate test scenarios based on diff + research.

Spawn 3 parallel generation agents:

```python
Task(subagent_type="test-generate-happy-path", prompt="""
Use sequential thinking to analyze diff.
Generate happy path test scenarios.
Diff: [diff]
Research: [unit + integration research]
""")

Task(subagent_type="test-generate-edge-cases", prompt="""
Use sequential thinking to analyze diff.
Generate edge case test scenarios.
Diff: [diff]
Research: [unit + integration research]
""")

Task(subagent_type="test-generate-integration", prompt="""
Use sequential thinking to analyze diff.
Generate integration test scenarios.
Diff: [diff]
Research: [integration research]
""")
```

**Output:**
```
🧪 SCENARIOS GENERATED

Happy path: X scenarios
Edge cases: Y scenarios
Integration: Z scenarios

Total: N test scenarios
```

---

### FASE 3: TEST PLAN CREATION (sequential thinking)

**Goal:** Analyze scenarios and split into automated vs manual.

Use sequential thinking to categorize each scenario:

```
[Sequential thinking analysis]
- Scenario: [description]
- Can be automated: [yes/no]
- Reason: [why automated or manual]
- Test type: [unit/feature/integration/manual]
```

**Criteria for automated:**
- Unit logic (functions, methods)
- API endpoints
- Database operations
- Validation rules
- Existing test infrastructure supports it

**Criteria for manual:**
- UI/UX flows
- Visual appearance
- Browser-specific behavior
- Complex user interactions
- No existing test infrastructure

**Output:**
```
📋 TEST PLAN

## Automated Tests (X tests)
| # | Scenario | Type | File |
|---|----------|------|------|
| 1 | [scenario] | unit | [file] |

## Manual Tests (Y tests)
| # | Scenario | Steps |
|---|----------|-------|
| 1 | [scenario] | [steps] |

**Confirm:** Doorgaan met test uitvoering?

options:
  - label: "Ja, voer tests uit (Recommended)", description: "Start automated tests, daarna manual tests"
  - label: "Alleen automated tests", description: "Skip manual tests"
  - label: "Nee, annuleer", description: "Stop het test proces"
  - label: "Uitleg", description: "Leg het test plan uit"
multiSelect: false
```

**Send notification (after FASE 1 + 2 parallel agents):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Test plan ready"
```

---

### FASE 4: AUTOMATED TEST EXECUTION

**Goal:** Run automated tests first.

1. Execute test runner script:
```bash
python scripts/run_automated_tests.py
```

2. Parse results

**Output:**
```
🤖 AUTOMATED TESTS

Passed: X
Failed: Y
Skipped: Z

[If failures:]
Failed tests:
- [test name]: [error]
```

---

### FASE 5: MANUAL TEST EXECUTION (interactive)

**Goal:** Guide user through manual tests step-by-step.

For each manual test:

```
🧪 TEST {X}/{total}: {Scenario Name}

1. {Step 1 instruction}
2. {Step 2 instruction}
3. {Step 3 instruction}

Expected: {expected result}

**Confirm:** Test resultaat?

options:
  - label: "Geslaagd (Recommended)", description: "Test werkt zoals verwacht"
  - label: "Gefaald", description: "Er zijn problemen gevonden"
  - label: "Overslaan", description: "Test nu niet uitvoeren"
  - label: "Uitleg", description: "Leg de verwachte resultaten uit"
multiSelect: false
```

**Handle responses:**
- **1 (ok):** `✅ {Scenario} - PASSED` → next test
- **2 (issues):** Ask for description → log issue → next test
- **3 (skip):** `⊘ {Scenario} - SKIPPED` → next test

---

### FASE 6: RESULTS REPORT

**Goal:** Generate combined report.

```
📊 TEST RESULTS

## Automated Tests
Passed: X | Failed: Y | Skipped: Z

## Manual Tests
Passed: X | Failed: Y | Skipped: Z

## Issues Found
| # | Test | Type | Issue |
|---|------|------|-------|
| 1 | [test] | [auto/manual] | [description] |

## Summary
Total tests: N
Pass rate: X%

Recommendation: [ready for merge / needs fixes]
```

**Send notification (workflow complete):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Testing complete"
```

---

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### Notifications
- **Notify when Claude waits for user input AFTER a long-running phase**
- Notification moments:
  - FASE 3 end (after FASE 1 + 2 parallel agents): "Test plan ready"
  - After FASE 6 (workflow complete): "Testing complete"
- Use the shared script: `.claude/scripts/notify.ps1` with `-Title` and `-Message` parameters
- Never skip notifications - user may be away from screen during agent execution

### Do
- Always check branch first (not main/master/develop)
- Check research cache before Context7 queries
- Use sequential thinking in all agents and test plan creation
- Run automated tests before manual tests
- Log all issues with clear descriptions
- Keep manual test steps concise (3-5 steps max)
- Update cache with new research findings

### Don't
- Skip branch validation
- Duplicate research already in cache
- Generate tests for unchanged code
- Overwhelm user with too many manual tests at once
- Mix automated and manual test execution
- Skip sequential thinking analysis