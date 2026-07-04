---
name: core-audit
description: Use with /core-audit to analyze and refine a skill from this conversation.
metadata:
  author: claude-config
  version: 4.0.0
  category: core
---

# Audit

Audit a skill from the current conversation: load its full surface (SKILL.md + lazy references), gather evidence from the real run, score it against house conventions, and apply a selective refactor via numbered-list approval.

**Trigger**: `/core-audit [skill-name]`

## Step 1: Load Skill from Chat

**Argument**: `/core-audit <skill-name>` with an existing skill → skip detection, select that skill directly (static mode unless it also ran in this conversation).

No argument → scan the conversation above for unique skill invocations (slash commands like `/dev-ship`, or skill names in `<command-name>` tags). Exclude `core-audit` itself from detection (it is always present via its own invocation).

**Resolution rules:**

- **Zero other skills** → nothing to audit: say so, mention the `/core-audit <skill-name>` form, and stop. (Self-audit stays possible via explicit `/core-audit core-audit`.)
- **Exactly one other skill** → auto-select. Show: `AUTO-SELECTED: [name] (only skill in conversation)`
- **Two or more** → AskUserQuestion: header "Skill", question "Which skill from this conversation do you want to audit?", one option per detected skill (most recent invocation first, first option gets "(Recommended)"), multiSelect: false. Max 4 options (AskUserQuestion limit) — with more detected skills, list the 4 most recent; older ones are reachable via the built-in Other.

**Load the full skill surface** — not just SKILL.md:

1. `.claude/skills/[name]/SKILL.md`
2. Every `.md` in `references/` and `techniques/` (Glob first). These are part of the skill: transition markers lazy-load them at runtime, so an audit that skips them misses most of the content.
3. List (don't read) `scripts/` and other resources.

Show:

```
LOADED: [name]
[one-line summary from description]
SKILL.md: [n] lines | references/: [n] files, [n] lines | techniques/: [n] files, [n] lines | scripts/: [list or none]
```

## Step 2: Evidence

### 2.1 Mode (auto-decided — do not ask)

- Target skill **actually executed** in this conversation (its phases ran, outputs are visible) → **trace mode**
- Otherwise (only invoked, mentioned, selected without a run, or supplied as argument) → **static mode**

Announce: `MODE: trace — real run found in conversation` or `MODE: static — no execution trace, conventions-only analysis`.

### 2.2 User pain points (trace mode only)

AskUserQuestion:

- header: "Experience"
- question: "What stood out during the [name] run?"
- multiSelect: true
- options:
  - label: "Nothing specific (Recommended)", description: "Analysis proceeds on trace + conventions only"
  - label: "Too many questions/modals", description: "Flow was interrupted by avoidable prompts"
  - label: "Output wrong or too verbose", description: "Results missed the mark or buried the signal"
  - label: "I had to correct or re-steer", description: "Claude deviated from what the skill should do"

Each selected pain point becomes a priority lens: findings in Steps 3–4 that explain it rank above generic findings.

## Step 3: Trace Analysis

> **Todo**: trace mode → Read `.claude/skills/core-audit/references/trace-analysis.md` and follow it. Static mode → skip to Step 4.

## Step 4: Analysis

### 4.1 Deterministic checks (run, don't judge)

Run via Bash and record raw results:

- **Size**: `wc -l` on SKILL.md and every file in `references/`/`techniques/`
- **Description budget**: character count of frontmatter `description` (target 40–80; long descriptions get truncated in the skill listing and break auto-routing)
- **Reference integrity**: every `references/...`/`techniques/...` path mentioned in SKILL.md exists on disk, and every file on disk is mentioned somewhere (orphan check)
- **Handoff**: frontmatter declares `reads:`/`writes:` → run `python3 scripts/check-handoff.py` from the claude-config repo root and capture violations for the target skill
- **Counterpart**: target matches `dev-*`/`game-*` with a pipeline counterpart → note it; structural findings must be flagged for sync (project CLAUDE.md § Rules for Changes)

### 4.2 Dimensions

Score each 1–5. Anchor: 5 = no findings, 4 = minor findings only, ≤3 = at least one significant finding.

1. **Redundancy** — instructions telling Claude what it already knows ("parse the JSON", "use the Write tool", generic best practices). Keep: project-specific conventions, non-obvious tool behavior, workflow sequences unique to this skill, constraints that override defaults.
2. **Signal-to-Noise** — explaining known concepts, verbose templates, information repeated across sections, excessive examples.
3. **Dead Paths** — conditions never true in practice, impossible-state handling, options nobody selects, references to nonexistent files/tools.
4. **Structure & Flow** — logical top-to-bottom order, related concerns grouped, decision points before the paths they gate, no forward references.
5. **Claude-Native Phrasing** — imperative and direct, no WHY for obvious decisions, trust Claude's formatting unless the format is critical, domain terms without definitions.
6. **Frontmatter Health** — description trigger-based (`skills/shared/SKILL-PATTERNS.md § Description Format`) and within budget, name matches folder, metadata complete, no security violations.
7. **Convention Compliance** — check against `skills/shared/SKILL-PATTERNS.md` (source of truth — cite sections, don't restate them):
   - Lazy Reference Loading: ≥30-line blocks that are conditional, static templates, or end-of-flow still inline? Estimate the token cost per run.
   - Task Tracking: 5+ phases without the TaskCreate pattern (skip for thinking/CRUD/short skills)?
   - AskUserQuestion conventions: recommended-first, correct multiSelect, Modal Option Cap, Interview Checkpoint when 3+ inputs are gathered
   - Pipeline handoff: shared state touched without `reads:`/`writes:` declarations?
8. **User Experience** — the run as the user experiences it: modal load (count, necessity, auto-decidable questions), approval gates (one clear gate, no double confirmation), output readability (does the user see decisions and results without digging), Next Steps guidance at completion, recommended defaults that match what most users pick. Static mode: judge the prescribed flow; trace mode: weigh against observed friction from Step 3.
9. **Trace** (trace mode only) — weight of Step 3 observations: deviations, friction, auto-decidable modals, unused loads.

### 4.3 Present Analysis

Map every finding to a location (`SKILL.md:line` or `references/{name}.md`) and an impact estimate (lines/tokens saved per run, modals removed, ambiguity resolved). Findings that explain a Step 2.2 pain point rank first.

```
ANALYSIS: [skill-name]

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| Redundancy | X/5 | [one-line] |
| Signal-to-Noise | X/5 | [one-line] |
| Dead Paths | X/5 | [one-line] |
| Structure | X/5 | [one-line] |
| Claude-Native | X/5 | [one-line] |
| Frontmatter | X/5 | [one-line] |
| Conventions | X/5 | [one-line] |
| User Experience | X/5 | [one-line] |
| Trace | X/5 | [one-line] (trace mode only)

Overall: [X/40 or X/45] — [Grade: A/B/C/D/F]

TOP FINDINGS:
1. [finding] — [location] — [impact]
2. ...
```

### 4.4 Early Exit

All dimensions 4+ or no findings → show the analysis, state that no changes are proposed, and stop:

```
ANALYSIS COMPLETE: [skill-name]
No significant findings — skill is in good shape. No changes proposed.
```

## Step 5: Refactor & Verify

> **Todo**: Read `.claude/skills/core-audit/references/refactor-plan.md` and follow it (selective approval → apply → verify).
