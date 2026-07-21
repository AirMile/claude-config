---
name: core-audit
description: Use with /core-audit to analyze and refine a skill from this conversation.
metadata:
  author: claude-config
  version: 4.4.0
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

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol now, before Step 3 — this routes the analysis (Steps 3–5.1) onto the stronger planning model (e.g. `opusplan`). Skip `EnterPlanMode` if a plan-mode system-reminder is already active; otherwise call it and note the plan-file path.

Steps 3–5.1 run in plan mode. `AskUserQuestion` and read-only Bash (Step 4.1's `wc`/`grep`/`check-handoff.py`/`check-task-markers.py`) keep working; file writes stay blocked until the `ExitPlanMode` gate in Step 5.2. Unlike thinking-hint skills, this skill calls `ExitPlanMode` even if it started already in plan mode — the output is edits to skill files, which plan mode blocks regardless of who entered it.

## Step 3: Trace Analysis

> **Todo**: trace mode → Read `.claude/skills/core-audit/references/trace-analysis.md` and follow it. Static mode → skip to Step 4.

## Step 4: Analysis

### 4.1 Deterministic checks (run, don't judge)

Run via Bash and record raw results:

- **Size**: `wc -l` on SKILL.md and every file in `references/`/`techniques/`
- **Hot-path cost**: `wc -c` on SKILL.md plus every reference read unconditionally near the top of the flow; `÷4 ≈` tokens loaded on every invocation. Report the eager/lazy ratio — what fraction of the total skill surface is hot path (always loaded) vs cold path (loaded only when a Read directive fires).
- **Description budget**: character count of frontmatter `description` (target 40–80; long descriptions get truncated in the skill listing and break auto-routing)
- **Reference integrity**: every `references/...`/`techniques/...` path mentioned in SKILL.md exists on disk, and every file on disk is mentioned somewhere (orphan check)
- **Drift**: grep the skill surface for references to other skills (`/skill-name`, `skills/...` paths), `scripts/...` invocations, and `shared/*.md` files; verify each target exists on disk. (Catches stale pointers after renames/consolidations — a wider net than the reference-integrity check, which only covers the skill's own `references/`.)
- **Handoff**: frontmatter declares `reads:`/`writes:` → run `python3 scripts/check-handoff.py` from the claude-config repo root and capture violations for the target skill
- **Counterpart**: target matches `dev-*`/`game-*` with a pipeline counterpart → note it; structural findings must be flagged for sync (project CLAUDE.md § Rules for Changes)
- **Task markers**: skill surface contains a `TaskCreate` seed → run `python3 scripts/check-task-markers.py --skill [name]` from the claude-config repo root; record WARNs (seeded phase without header, phase never marked `in_progress`/`completed`, unbalanced code fences). No seed on a 5+-phase skill is a dimension 7 finding (Task Tracking convention); dimension 10 cites it only as memory-reliance evidence — don't double-count.
- **Hedge census**: `grep -nE '\b(consider|if needed|where appropriate|as appropriate|optionally|best-effort|you may|you could|may want to|should probably|suggest|try to)\b'` plus `grep -inE 'silent(ly)?'` across the skill surface — record counts + locations as raw evidence for dimension 10 (Execution Adherence). The census locates, it never fails: hedges on genuinely optional steps and intended silent-skips are correct, and hits inside identifiers/CLI args (e.g. `suggest` in `suggest-tags`) are noise — report raw counts, cite only real hedge prose as evidence.
- **Delegation/plan-mode census**: grep the skill surface for `EnterPlanMode|Entry protocol` and `subagent_type|Agent tool|Workflow|fork` — record hits/absence as raw evidence for dimensions 7 and 8 (presence ≠ finding; the shared-doc criteria decide).

### 4.2 Dimensions

Score each 1–5. Anchor: 5 = no findings, 4 = minor findings only, ≤3 = at least one significant finding.

1. **Redundancy** — instructions telling Claude what it already knows ("parse the JSON", "use the Write tool", generic best practices). Keep: project-specific conventions, non-obvious tool behavior, workflow sequences unique to this skill, constraints that override defaults.
2. **Signal-to-Noise** — explaining known concepts, verbose templates, information repeated across sections, excessive examples.
3. **Dead Paths** — conditions never true in practice, impossible-state handling, options nobody selects, references to nonexistent files/tools.
4. **Structure & Flow** — logical top-to-bottom order, related concerns grouped, decision points before the paths they gate, no forward references.
5. **Claude-Native Phrasing** — imperative and direct, no WHY for obvious decisions, trust Claude's formatting unless the format is critical, domain terms without definitions.
6. **Frontmatter Health** — description trigger-based (`skills/shared/SKILL-PATTERNS.md § Description Format`) and within budget, name matches folder, metadata complete, no security violations.
7. **Convention Compliance** — check against `skills/shared/SKILL-PATTERNS.md` (source of truth — cite sections, don't restate them):
   - Task Tracking: 5+ phases without the TaskCreate pattern (skip for thinking/CRUD/short skills)?
   - AskUserQuestion conventions: recommended-first, correct multiSelect, Modal Option Cap, Interview Checkpoint when 3+ inputs are gathered
   - Pipeline handoff: shared state touched without `reads:`/`writes:` declarations?
   - Plan-mode protocol (`shared/PLAN-MODE.md § When to apply`): a thought-heavy phase (multi-step synthesis, research, architecture generation) without a plan-mode entry — routers like opusplan then run that thinking on the execution model; or plan-mode machinery on skills the doc excludes (short CRUD, pure validation, read+format skills).
8. **Token Efficiency** — check against `skills/shared/SKILL-PATTERNS.md § Token Efficiency` (cite, don't restate). Use the 4.1 hot-path cost + eager/lazy ratio as evidence. Look for: lazy-loading candidates left inline (`§ Lazy Reference Loading` criteria), the eager-read trap (references Read unconditionally at the top), shared content duplicated instead of cited, whole-file reads where a section would do, verbose mandatory output templates, deterministic work that belongs in a script, and agent-cost issues (`§ Pass Paths, Not Content`, `§ Agent Context Block`, `§ Agent Model Selection`, or agents spawned where an inline step suffices). Also check the inverse — delegation left on the table: heavy intermediate tool output produced inline where `§ Fork Delegation` or `§ Context Aggregation / Scout Agents` criteria hold; 3+ independent subtasks run sequentially where `§ Parallel Dispatch` applies (large fan-outs: a background Workflow). Most skills correctly run inline — flag only when the shared-doc criteria genuinely hold.
9. **Robustness** — (a) **Failure paths**: does the skill define what happens when a script exits non-zero, a file is missing, or a precondition fails — or only the happy path? (b) **Repeat-safety**: on a second run, does it produce duplicate commits/backlog items, overwrite state, or break a handoff — or is it idempotent?
10. **Execution Adherence** — will a Sonnet/Opus-level executor run every step as written, or skip, weaken, or improvise it? Judge the instructions against the weakest model that executes the skill, not against the auditor.
    (a) **Skip-resistance**: optional-sounding wording on mandatory steps ("consider", "if needed", "where appropriate", "skip … silently" — mandatory steps use imperatives); a load-bearing rule buried mid-section instead of at a phase boundary or in a bolded gate / `> **Todo**` marker (interior rules get read past — restate near the top or bottom of the block); non-blocking steps whose only output is a warning/log nothing downstream reads (no artifact forces execution — later phases should consume earlier phases' outputs); flat lists of 8+ mandatory items whose tail gets dropped (split into phases or a checklist); memory reliance across 5+ phases without Task Tracking or per-phase restatement (compaction drops early instructions — `SKILL-PATTERNS.md § Task Tracking`); vague success criteria ("ensure quality") where a runnable command or countable condition exists; no **STOP** gate before irreversible actions (delete/force-push/migrate/overwrite); done-claims without demanded evidence (`CODING-RULES.md R009`).
    (b) **Executor fit**: judgment calls a Sonnet-level executor can plausibly resolve wrong that a named script or deterministic check could decide instead (eyeball-vs-run); undefined jargon or implied domain knowledge (OKLCH, WCAG ratios, `.tres` format — define or cite); instructions overriding a model default (don't summarize, don't create files, ask before acting) stated once in plain prose instead of a marked hard rule or an enforcing mechanism (a required tool call / output schema); scope-underspecified rules — one worked example with no "apply to every match" clause (Sonnet executes literally, won't generalize), a branch condition ("exactly one X") silent on adjacent cases (0, 2+), or empirical-vs-judgment ambiguity ("if it would break the build" — run it or infer?); sentences packing 3+ constraints that need re-reading to parse — one instruction per line.
    Use the 4.1 hedge census and task-marker check as evidence. Trace mode: observed Step 3 deviations outrank static prediction for this score.
11. **User Experience** — the run as the user experiences it: modal load (count, necessity, auto-decidable questions), approval gates (one clear gate, no double confirmation), output readability (does the user see decisions and results without digging), Next Steps guidance at completion, recommended defaults that match what most users pick. Static mode: judge the prescribed flow; trace mode: weigh against observed friction from Step 3.
12. **Trace** (trace mode only) — weight of Step 3 observations: deviations (classified skip/weaken/improvise), friction, auto-decidable modals, unused loads.

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
| Token Efficiency | X/5 | [one-line] |
| Robustness | X/5 | [one-line] |
| Execution Adherence | X/5 | [one-line] |
| User Experience | X/5 | [one-line] |
| Trace | X/5 | [one-line] (trace mode only)

Overall: [X/55 or X/60] — [Grade: A/B/C/D/F]

TOP FINDINGS:
1. [finding] — [location] — [impact]
2. ...
```

### 4.4 Early Exit

All dimensions 4+ or no findings → show the analysis, state that no changes are proposed, write that to the plan file, and call `ExitPlanMode` to leave plan mode before stopping:

```
ANALYSIS COMPLETE: [skill-name]
No significant findings — skill is in good shape. No changes proposed.
```

## Step 5: Refactor & Verify

> **Todo**: Read `.claude/skills/core-audit/references/refactor-plan.md` and follow it (selective approval → apply → verify).
