---
name: game-debug
description: >-
  Systematic debugging for Godot projects with inline investigation,
  root cause analysis, and 3 fix strategies. Use for runtime errors, physics
  bugs, signal issues, or scene tree problems.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: game
---

# Debug

Structured 9-phase debugging: context → intake → investigate → analyze → research → fix plans → select → implement → verify.

## FASE 0: Context Loading

**Stack context** (optioneel, skip wat niet bestaat):

- Lees CLAUDE.md `### Stack` sectie
- Lees `.claude/research/architecture-baseline.md`

**Project context** (optioneel, skip als niet bestaat):

- Lees `.project/project.json` → extract:
  - `stack` (engine, language, packages)
  - `data.entities` (names, fields, relations)
- Lees `.project/project-context.json` (als bestaat) → extract:
  - `context` (structure, patterns)
  - `architecture` (diagram, files)

**Active feature detectie** (optioneel):

- Check `.project/session/active-*.json` files
- Fallback: lees `.project/backlog.html` → zoek meest recente `"DOING"` feature (features met `-ing` stage suffix zijn actief)
- Als actieve feature gevonden: noteer als context hint voor investigation agents

**Stel DEBUG_CONTEXT samen** (alle info beschikbaar voor inline investigation):

```
STACK: {engine} ({language}) — {packages}
ARCHITECTURE: {baseline patterns of "niet beschikbaar"}
PATTERNS: {context.patterns of "niet beschikbaar"}
STRUCTURE: {context.structure of "niet beschikbaar"}
ACTIVE FEATURE: {feature naam + status of "geen"}
ENTITIES: {data.entities of "niet beschikbaar"}
```

Als niets beschikbaar → ga door zonder context (backwards compatible).

---

## FASE 1: Problem Intake

### Step 1: Classify

AskUserQuestion:

- header: "Probleem Type"
- question: "Wat voor type probleem is dit?"
- options:
  - "Runtime Error" — Crashes, GDScript errors, null references
  - "Logic Bug" — Verkeerde game behavior, state issues
  - "Performance Issue" — FPS drops, memory leaks, physics lag
  - "Scene/Signal Issue" — Node connections, signal flow, scene tree problemen

### Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "Welke informatie heb je over de error?"
- options:
  - "Ik heb een error message" — Exacte foutmelding uit Godot console
  - "Ik heb een stack trace" — Volledige stack trace beschikbaar
  - "Ik heb beide" — Error message en stack trace
  - "Ik heb alleen een screenshot" — Visuele weergave van de error

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Gedrag Details"
- question: "Beschrijf het verschil tussen verwacht en werkelijk gedrag:"
- options:
  - "Ik weet exact wat er fout gaat" — Expected vs actual beschrijfbaar
  - "Game state klopt niet" — Verkeerde waarden, verkeerde state
  - "Actie werkt niet" — Input, collision, ability faalt
  - "Timing/volgorde fout" — Dingen gebeuren op verkeerd moment

Then: ask for specific expected vs actual behavior.

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "Wanneer treedt het performance probleem op?"
- options:
  - "Bij specifieke actie" — Bepaalde ability, collision, of scene load
  - "Altijd traag" — Consistent lage FPS
  - "Na verloop van tijd" — Start soepel, wordt langzamer (memory leak)
  - "Bij veel nodes" — Alleen traag met veel instanties

Then: ask about scale/context details.

**Scene/Signal Issue:**
AskUserQuestion:

- header: "Scene/Signal Details"
- question: "Welk type verbindingsprobleem is dit?"
- options:
  - "Signal niet ontvangen" — Signal emitted maar receiver reageert niet
  - "Node niet gevonden" — get_node() of @onready faalt
  - "Scene tree corrupt" — Nodes verdwijnen, verkeerde parent, orphans
  - "Connect/disconnect" — Signals connecten of disconnecten niet correct

Then: ask for node paths, signal names, scene structure.

### Step 3: Bevestig samenvatting

Show summary of type + symptom + context + details gathered.

AskUserQuestion:

- header: "Bevestiging"
- question: "Klopt deze probleem samenvatting?"
- options:
  - "Ja, start onderzoek (Aanbevolen)" — Start inline investigation
  - "Nee, correctie nodig" — Meer details of correcties geven

If "Nee" → ask for corrections, update summary, re-confirm.

---

## FASE 2: Codebase Investigation (Explore agent)

Spawn one Explore agent (`subagent_type="Explore"`, thoroughness: "very thorough") to investigate in an isolated context. This keeps source file reads and git output out of the main session.

Agent prompt:

```
Investigate this Godot bug. Perform 3 passes that build on each other.

DEBUG_CONTEXT:
{DEBUG_CONTEXT from FASE 0}

PROBLEM:
{problem summary from FASE 1}
{error message / stack trace / details}

PASS 1 — ERROR TRACE:
- Parse stack trace / error message → identify root location
- Read the source file at the error location (GDScript .gd files)
- Trace the call stack: what called this code? What signals trigger it?
- Map the exception/error flow: where is it caught (or not)?

PASS 2 — CONTEXT MAP (use locations from Pass 1):
- Read the scene tree: which nodes reference each other? Parent/child?
- Check signal connections: connect() calls, @onready vars, $NodePath references
- Trace data flow: exports, autoloads, Resources passed between scripts
- Identify external factors (physics layers, input actions, scene transitions)

PASS 3 — CHANGE ANALYSIS (use files from Pass 1+2):
- git log --oneline -10 -- {affected files}
- git blame {error location}
- Was this working before? What changed?

RETURN FORMAT:
INVESTIGATION_START
Error location: {file:line}
Call stack: {caller → callee chain, including signals}
Root code: {the problematic code snippet, max 20 lines}
Scene tree: {relevant node hierarchy}
Signal flow: {signal chain involved}
Recent changes: {relevant commits with dates}
Regression risk: {yes/no — was this area recently modified?}
INVESTIGATION_END
```

Parse the agent's `INVESTIGATION_START...END` block — only the compact findings enter the main context.

---

## FASE 3: Root Cause Analysis

Analyze:

1. Combine findings from all 3 investigation passes
2. Identify patterns and correlations
3. Form hypotheses about root cause
4. Evaluate each hypothesis against evidence
5. Test one hypothesis at a time — never combine multiple fixes in a single verification step
6. Determine most likely root cause
7. Identify knowledge gaps for FASE 4

Present findings + hypothesis + confidence (high/medium/low) + research topics needed.

---

## FASE 4: Context7 Research

1. `mcp__context7__resolve-library-id` for Godot-related libraries
2. `mcp__context7__query-docs` for:
   - Known bugs/issues related to root cause
   - Best practices for Godot patterns
   - Recommended solutions

Focus: signal patterns → correct usage, scene tree lifecycle → proper node management, physics → collision layers/masks, state machines → proper implementation.

---

## FASE 5: Fix Plan Generation

Launch 3 agents in parallel:

| Agent         | Philosophy           | Focus                                      |
| ------------- | -------------------- | ------------------------------------------ |
| fix-minimal   | "Kleinste wijziging" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Volledige fix"      | Root cause, add GUT tests, clean up        |
| fix-defensive | "Preventief"         | Safeguards, null checks, signal validation |

Each receives: root cause analysis + research findings + affected files.
Each returns: specific changes with file:line refs, risk (low/medium/high), scope, trade-offs.

---

## FASE 6: Plan Selection

Present all 3 options with approach, changes count, risk level, and trade-offs.
Include recommendation based on context.

### Step 1: Strategy

AskUserQuestion:

- header: "Fix Strategie"
- question: "Welke fix aanpak wil je gebruiken?"
- options:
  - "Minimal (Aanbevolen voor productie)" — Kleinste wijziging, laag risico
  - "Thorough" — Volledige fix met root cause + GUT tests
  - "Defensive" — Safeguards en validatie tegen herhaling

### Step 2: Fixes selecteren

AskUserQuestion (multiSelect: true):

- header: "Fixes Selecteren"
- question: "Welke fixes wil je toepassen uit de [gekozen] strategie?"
- options: generated from agent output — each fix with file:line + description, plus "Alle fixes toepassen"

---

## FASE 7: Implementatie

Apply selected fixes from chosen strategy. Document each change with file:line references.

---

## FASE 8: Verificatie

1. Run GUT tests if test suite exists
2. If no tests: suggest manual verification steps based on the problem type
3. Show summary of changes made + test results
4. Ask user to confirm the fix resolves the original problem

**Output:**

```
DEBUG COMPLETE: {issue}
========================
Root cause: {samenvatting}
Fix: {wat er gewijzigd is}
Tests: {pass/fail status}

Next steps:
  1. /game-verify {feature} → herverificatie na fix
  2. /game-build {feature} → als rebuild nodig is
```
