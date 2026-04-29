---
name: dev-debug
description: Systematic debugging with inline investigation, root cause analysis, and 3 fix strategies. Use for runtime errors, build failures, unexpected behavior, or test failures.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Debug

Structured 9-phase debugging: context → intake → investigate → analyze → research → fix plans → select → implement → verify.

## FASE 0: Context Loading

**Stack context** (optioneel, skip wat niet bestaat):

- Lees CLAUDE.md `### Stack` sectie
- Lees `.claude/research/stack-baseline.md`

**Project context** (optioneel, skip als niet bestaat):

- Lees `.project/project.json` → extract:
  - `stack` (framework, language, packages)
  - `endpoints` (method, path, auth)
  - `data.entities` (names, fields, relations)
- Lees `.project/project-context.json` (als bestaat) → extract:
  - `context` (structure, routing, patterns)

**Active feature detectie** (optioneel):

- Check `.project/session/active-*.json` files
- Fallback: lees `.project/backlog.html` → zoek meest recente feature met `status === "DOING"`
- Als actieve feature gevonden: noteer als context hint voor investigation agents

**Worktree switch** (alleen als active feature gedetecteerd):

Als active feature gevonden in vorige stap, voer steps 1-3 uit `shared/WORKTREE.md` (compute expected_path, check registered).

- Worktree bestaat én pwd == main_root → AskUserQuestion:
  - header: "Worktree"
  - question: "Active feature '{name}' heeft worktree {short_path}. Hoe debuggen?"
  - options:
    - "Switch naar worktree (Recommended)" → `EnterWorktree(path: expected_path)`
    - "Standalone op huidige branch" → skip switch
- Worktree bestaat én pwd in andere worktree dan expected → AskUserQuestion (debug is ad-hoc, geen hard fail):
  - header: "Worktree"
  - question: "Je zit in worktree {pwd_short}, active feature is '{name}' (worktree {expected_short}). Hoe verder?"
  - options:
    - "Hier blijven debuggen (Recommended)" → skip switch, debug op huidige worktree
    - "Switch naar feature-worktree" → `ExitWorktree(action: "keep")` + `EnterWorktree(path: expected_path)`
    - "Switch naar main" → `ExitWorktree(action: "keep")` (alleen als pwd in een door deze session aangemaakte worktree zit; anders skip)
- pwd == expected_path → already there, skip switch
- Geen active feature of geen worktree → skip switch, debug draait standalone

**Stel DEBUG_CONTEXT samen** (alle info beschikbaar voor inline investigation):

```
STACK: {framework} ({language}) — {packages}
PATTERNS: {context.patterns of "niet beschikbaar"}
STRUCTURE: {context.structure of "niet beschikbaar"}
ACTIVE FEATURE: {feature naam + status of "geen"}
ENDPOINTS: {endpoints of "niet beschikbaar"}
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
  - "Runtime Error" — Crashes, exceptions, error messages in console of UI
  - "Logic Bug" — Verkeerde output, unexpected behavior
  - "Performance Issue" — Traag, memory leaks, timeouts
  - "Integration Issue" — API failures, data sync, externe systemen

### Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "Welke informatie heb je over de error?"
- options:
  - "Ik heb een error message" — Exacte foutmelding beschikbaar
  - "Ik heb een stack trace" — Volledige stack trace beschikbaar
  - "Ik heb beide" — Error message en stack trace
  - "Ik heb alleen een screenshot" — Visuele weergave

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Gedrag Details"
- question: "Beschrijf het verschil tussen verwacht en werkelijk gedrag:"
- options:
  - "Ik weet exact wat er fout gaat" — Expected vs actual beschrijfbaar
  - "Output is verkeerd" — Verkeerde waarde of weergave
  - "Actie werkt niet" — Button, form, interactie faalt
  - "Data klopt niet" — Verkeerde data getoond of opgeslagen

Then: ask for specific expected vs actual behavior.

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "Wanneer treedt het performance probleem op?"
- options:
  - "Bij specifieke actie" — Bepaalde pagina, button click, of data load
  - "Altijd traag" — Consistent trage applicatie
  - "Na verloop van tijd" — Start snel, wordt langzamer (memory leak)
  - "Bij veel data" — Alleen traag met grote datasets

Then: ask about scale/context details.

**Integration Issue:**
AskUserQuestion:

- header: "Integratie Details"
- question: "Welk extern systeem is betrokken?"
- options:
  - "REST API" — HTTP endpoints, fetch calls
  - "Database" — Supabase, Firebase, andere DB
  - "Third-party service" — Auth, payment, analytics
  - "File system / Storage" — Uploads, downloads, cloud storage

Then: ask for API/service details and error responses.

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

Spawn one Explore agent (`subagent_type="Explore"`, thoroughness: "very thorough") to investigate in an isolated context. This keeps source file reads and git output out of the main session — critical because FASE 3-8 still need context space for root cause analysis, fix planning, and implementation.

Agent prompt:

```
Investigate this bug. Perform 3 passes that build on each other.

DEBUG_CONTEXT:
{DEBUG_CONTEXT from FASE 0}

PROBLEM:
{problem summary from FASE 1}
{error message / stack trace / details}

PASS 1 — ERROR TRACE:
- Parse stack trace / error message → identify root location
- Read the source file at the error location
- Trace the call stack: what called this code? What data flows in?
- Map the exception/error flow: where is it caught (or not)?

PASS 2 — CONTEXT MAP (use locations from Pass 1):
- Read imports and dependents of the affected file(s)
- Trace data flow: where does input come from? Where does output go?
- Check endpoints and entities from DEBUG_CONTEXT for relevant connections
- Identify external factors (APIs, DB, file system, environment)

PASS 3 — CHANGE ANALYSIS (use files from Pass 1+2):
- git log --oneline -10 -- {affected files}
- git blame {error location}
- Was this working before? What changed?

RETURN FORMAT:
INVESTIGATION_START
Error location: {file:line}
Call stack: {caller → callee chain}
Root code: {the problematic code snippet, max 20 lines}
Dependencies: {key imports and dependents}
Data flow: {input source → processing → output}
External factors: {APIs, DB, env vars involved}
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

1. `mcp__context7__resolve-library-id` for relevant libraries
2. `mcp__context7__query-docs` for:
   - Known bugs/issues related to root cause
   - Best practices for this scenario
   - Recommended patterns/solutions

Focus: dependency issues → version docs/migration guides, pattern misuse → correct usage, edge cases → error handling patterns.

---

## FASE 5: Fix Plan Generation

Launch 3 agents in parallel:

| Agent         | Philosophy           | Focus                                      |
| ------------- | -------------------- | ------------------------------------------ |
| fix-minimal   | "Kleinste wijziging" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Volledige fix"      | Root cause, add tests, clean up            |
| fix-defensive | "Preventief"         | Safeguards, validation, prevent recurrence |

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
  - "Thorough" — Volledige fix met root cause + tests
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

1. Run relevant tests (if test suite exists)
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
  1. /dev-verify {feature} → herverificatie na fix
  2. /dev-build {feature} → als rebuild nodig is
```
