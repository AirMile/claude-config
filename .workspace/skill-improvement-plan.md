# Skill Improvement Plan

Based on analysis of 44 skills against Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026).

**Status**: Phase 1-3, P5, P7 COMPLETED (2026-02-13) — P6 SKIPPED per user request

---

## Priority 1: ~~CRITICAL~~ DONE — Add Missing `name` Field

**Impact**: High — `name` is listed as REQUIRED in the Anthropic spec
**Effort**: Low — bulk operation
**Status**: COMPLETED — All 44 skills now have `name` field matching folder name

### What

Every SKILL.md is missing the `name` field in frontmatter. The Anthropic guide states:

```yaml
---
name: your-skill-name  # REQUIRED - kebab-case, must match folder name
description: ...        # REQUIRED
---
```

### Action

Add `name` field to all 44 skills, matching the folder name:

| Folder | Add `name` |
|--------|-----------|
| core-commit | `name: core-commit` |
| core-create | `name: core-create` |
| core-delete | `name: core-delete` |
| core-edit | `name: core-edit` |
| core-explore | `name: core-explore` |
| core-profile | `name: core-profile` |
| core-resume | `name: core-resume` |
| core-save | `name: core-save` |
| core-setup | `name: core-setup` |
| core-task | `name: core-task` |
| dev-build | `name: dev-build` |
| dev-define | `name: dev-define` |
| dev-legacy-debug | `name: dev-legacy-debug` |
| dev-legacy-owasp | `name: dev-legacy-owasp` |
| dev-legacy-verify | `name: dev-legacy-verify` |
| dev-plan | `name: dev-plan` |
| dev-refactor | `name: dev-refactor` |
| dev-server | `name: dev-server` |
| dev-test | `name: dev-test` |
| dev-worktree | `name: dev-worktree` |
| frontend-build | `name: frontend-build` |
| frontend-compose | `name: frontend-compose` |
| frontend-convert | `name: frontend-convert` |
| frontend-seo | `name: frontend-seo` |
| frontend-theme | `name: frontend-theme` |
| game-backlog | `name: game-backlog` |
| game-build | `name: game-build` |
| game-define | `name: game-define` |
| game-test | `name: game-test` |
| project-add | `name: project-add` |
| project-list | `name: project-list` |
| project-remove | `name: project-remove` |
| story-character | `name: story-character` |
| story-new | `name: story-new` |
| story-next | `name: story-next` |
| story-select | `name: story-select` |
| story-world | `name: story-world` |
| team-review | `name: team-review` |
| team-test | `name: team-test` |
| thinking-analyze | `name: thinking-analyze` |
| thinking-brainstorm | `name: thinking-brainstorm` |
| thinking-critique | `name: thinking-critique` |
| thinking-idea | `name: thinking-idea` |
| thinking-plan | `name: thinking-plan` |

---

## Priority 2: HIGH — Improve Description Fields

**Impact**: High — descriptions determine when Claude loads skills
**Effort**: Medium — requires rewriting each description

### What

The Anthropic guide mandates descriptions follow this pattern:

```
[What it does] + [When to use it] + [Key capabilities]
```

Good example from the guide:
> "Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions 'sprint', 'Linear tasks', 'project planning', or asks to 'create tickets'."

### Current Issues

**Category A: Missing trigger phrases** (most skills)

These descriptions say WHAT but not WHEN:

| Skill | Current Description | Issue |
|-------|-------------------|-------|
| core-commit | "Commit changes met automatisch gegenereerde message" | No trigger phrases |
| dev-build | "Build features with automatic stack detection and technique selection" | No trigger phrases |
| team-review | "Code review for feature branches before PR" | No trigger phrases |
| story-select | "Select a story to work on and view its summary" | Too vague |
| dev-legacy-verify | "Quick verification - typecheck + lint (optional tests)" | No trigger phrases |

**Category B: Too vague / generic**

| Skill | Current Description | Issue |
|-------|-------------------|-------|
| core-save | "Save current session (command workflow or chat)" | What does "save" mean? |
| core-resume | "Resume saved command or chat sessions" | What sessions? |
| core-explore | "Explore the codebase with agents for a specific question" | Very generic |

### Proposed Rewrites

NOTE: Since most skills use `disable-model-invocation: true`, trigger phrases in description
matter less for auto-invocation. However, they still help Claude understand context and
improve the skill's self-documentation. For skills WITHOUT disable-model-invocation
(core-create, core-edit, frontend-compose), trigger phrases are CRITICAL.

**Auto-invocable skills (no disable-model-invocation):**

```yaml
# core-create (CRITICAL - auto-invocable)
description: >-
  Create new skills interactively with optional resource bundling.
  Use when user wants to make, create, build, or add a new skill.
  Handles SKILL.md generation, frontmatter, references, and scripts.

# core-edit (CRITICAL - auto-invocable)
description: >-
  Edit existing skills with rename, delete, and resource management.
  Use when user wants to modify, update, change, or improve an existing skill.

# frontend-compose (CRITICAL - auto-invocable)
description: >-
  Compose low-fidelity HTML wireframes using parallel design agents with iterative refinement.
  Use when user asks for wireframe, mockup, prototype, layout exploration, or UI design sketches.
  Generates multiple design variants for comparison.
```

**User-invocable skills (with disable-model-invocation) — improved for clarity:**

```yaml
# core-commit
description: >-
  Analyze staged git changes and generate conventional commit messages.
  Use with /core-commit. Detects rebase/merge state, validates changes, follows project conventions.

# dev-build
description: >-
  Build features with automatic stack detection and TDD/implementation-first technique selection.
  Use with /dev-build after /dev-define. Reads requirements from workspace and builds sequentially.

# team-review
description: >-
  Code review for feature branches before PR. Analyzes all commits since branch creation,
  researches best practices via Context7, generates constructive feedback on naming, patterns, structure.

# story-select
description: >-
  Select an existing story project to work on. Lists available stories from workspace,
  shows summary and progress, sets active story context for other story skills.

# thinking-plan
description: >-
  Transform requirements into prioritized implementation plan with research.
  Outputs structured markdown with phases, dependencies, and estimates.
```

---

## Priority 3: MEDIUM — Add Metadata Fields

**Impact**: Medium — improves discoverability and maintainability
**Effort**: Low — template addition

### What

Add optional but recommended fields from the Anthropic spec:

```yaml
metadata:
  author: mauricevdm
  version: 1.0.0
  category: core|dev|frontend|game|project|story|team|thinking
```

### Where

Add to all skills. Example for core-commit:

```yaml
---
name: core-commit
description: >-
  Analyze staged git changes and generate conventional commit messages.
  Use with /core-commit. Detects rebase/merge state, validates changes.
disable-model-invocation: true
metadata:
  author: mauricevdm
  version: 1.0.0
  category: core
---
```

---

## Priority 4: MEDIUM — Standardize Language

**Impact**: Medium — consistency and professionalism
**Effort**: Medium — content rewriting

### What

Skills mix Dutch and English inconsistently:
- Descriptions: some Dutch, some English, some mixed
- Body content: some Dutch, some English

### Recommendation

Choose ONE primary language for descriptions. Since most descriptions are already in English,
standardize to **English descriptions** (body content can remain mixed where it serves the user).

**Skills needing description language fix:**

| Skill | Current | Fix |
|-------|---------|-----|
| core-commit | "Commit changes met automatisch gegenereerde message" | "Analyze staged changes and generate conventional commit messages" |
| dev-legacy-owasp | "Complete OWASP Top 10:2025 security audit met parallel agents" | "Complete OWASP Top 10:2025 security audit with parallel agents" |
| project-remove | "Verwijder project met veilige junction cleanup" | "Remove project with safe junction cleanup" |
| project-list | "Toon alle projecten met junction-based .claude/ config" | "List all projects with junction-based .claude/ config" |
| frontend-theme | "Design systeem beheer - tokens CRUD, auto-extractie, en theme modes" | "Design system management - token CRUD, auto-extraction, and theme modes" |
| thinking-plan | "Intelligente planning met research en markdown output" | "Intelligent planning with research and markdown output" |

---

## Priority 5: ~~LOW~~ DONE — Progressive Disclosure Optimization

**Impact**: Low-Medium — token efficiency
**Effort**: Medium-High — requires restructuring some skills
**Status**: COMPLETED — All 5 oversized skills now under 5000 words

### Results

| Skill | Before | After | Extracted To |
|-------|--------|-------|-------------|
| frontend-convert | 5843 | 4867 | references/appendix.md |
| frontend-compose | 5727 | 4829 | references/appendix.md (+ Edit Mode Features) |
| frontend-build | 5165 | 4688 | references/appendix.md |
| dev-test | 4196 | 3707 | references/test-classification.md |
| game-test | 3687 | 3687 | Already under limit, no extraction needed |

Extracted sections: Output Structure, Error Recovery, DevInfo Integration, Framework Notes, Edit Mode Features.
Replaced with `> See references/...` links for progressive disclosure.

---

## Priority 6: SKIPPED — Remove Legacy Skills

**Status**: SKIPPED per user request

---

## Priority 7: ~~NICE-TO-HAVE~~ DONE — Add Troubleshooting Sections

**Impact**: Low — improves robustness
**Effort**: Medium
**Status**: COMPLETED — 5 complex skills now have troubleshooting sections

### Results

Added `## Troubleshooting` with common Error/Cause/Solution patterns to:
- **dev-build**: Stack detection, missing define files, test failures, technique detection
- **dev-test**: Dev server not running, browser agent timeouts, classification overrides
- **frontend-compose**: Agent timeouts, broken HTML, theme not applied
- **game-build**: GUT tests, scene tree errors, signal connections, Ralph loop convergence
- **core-setup**: Stack detection fails, dependency install, CLAUDE.md generation

---

## Implementation Order

1. **Phase 1** (Quick wins): Add `name` fields + fix description language → 1 session
2. **Phase 2** (High impact): Rewrite descriptions with trigger phrases → 1-2 sessions
3. **Phase 3** (Polish): Add metadata fields → 1 session
4. **Phase 4** (Optimization): Progressive disclosure audit + legacy cleanup → 1-2 sessions
5. **Phase 5** (Robustness): Add troubleshooting sections → ongoing

---

## Summary Scorecard

| Criterion | Before | After | Status |
|-----------|--------|-------|--------|
| `name` field present | 0/44 | 44/44 | ✅ DONE |
| Description has trigger phrases | ~5/44 | 44/44 | ✅ DONE |
| Consistent language (English) | ~30/44 | 44/44 | ✅ DONE |
| Metadata fields | 0/44 | 44/44 | ✅ DONE |
| Under 5000 words | ~40/44 | 44/44 | ✅ DONE |
| Troubleshooting section | ~2/44 | 7/44 | ✅ DONE |
| core-create enforces spec | No | Yes | ✅ DONE |
| core-edit validates spec | No | Yes | ✅ DONE |
| No XML in frontmatter | 44/44 | 44/44 | ✅ PASS |
| Kebab-case naming | 44/44 | 44/44 | ✅ PASS |
| SKILL.md exact naming | 44/44 | 44/44 | ✅ PASS |
| No README.md in skill folders | 44/44 | 44/44 | ✅ PASS |
