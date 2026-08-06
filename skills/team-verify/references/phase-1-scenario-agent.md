# PHASE 1: Research + Scenario Generation — Explore Agent Prompt

Load this file when entering PHASE 1. Contains the full Explore agent prompt for test scenario research.

---

Spawn one Explore agent (`subagent_type="Explore"`, `model: "sonnet"`, thoroughness: "very thorough") with the following prompt:

```
{STACK_CONTEXT}

Feature: {feature-name}
Diff: {diff summary — changed files + key changes, NOT full diff}

{BRIEF_REVIEW: "Requirements: {JSON of requirements[]}" + "testStrategy: {JSON of testStrategy[]}"}
{TODO_REVIEW: "Expectations: {parsed expectations from PHASE 0.5}"}

OPERATIONAL STANCE: Failure-seeking. Default: scenarios have been missed.
Expect at least 3 edge cases and 2 integration risks. Fewer requires justification.
Self-check: "Which edge cases has the developer probably not considered?"

TASKS:
1. Check existing test infrastructure: grep for test files, configs, frameworks
2. Research via Context7: resolve-library-id + query-docs for the testing framework
   Focus: test structure conventions, assertion patterns, mocking, integration setup
3. Generate test scenarios in 3 sections:
   - HAPPY PATH: core functionality works as expected
   - EDGE CASES: boundary conditions, validation, error states (MINIMUM 3)
   - INTEGRATION: cross-component interaction, API flows, data persistence (MINIMUM 2)
   {BRIEF_REVIEW: "Map each scenario to a requirement ID (REQ-001, etc). Skip MISSING requirements."}
   {TODO_REVIEW: "Map each scenario to an expectation number (#1, #2, etc)."}

RETURN FORMAT:
RESEARCH_SUMMARY: {2-3 lines: testing framework, key conventions, existing test patterns}

SCENARIOS_START
HAPPY PATH:
{numbered scenarios}

EDGE CASES:
{numbered scenarios}

INTEGRATION:
{numbered scenarios}
SCENARIOS_END

Total: N test scenarios
```

Parse the agent output — only the structured `SCENARIOS_START...END` block and research summary enter the main context.
