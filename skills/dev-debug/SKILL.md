---
name: dev-debug
description: Systematic debugging with parallel investigation agents, root cause analysis, and 3 fix strategies. Use for runtime errors, build failures, unexpected behavior, or test failures.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Debug

Structured 8-phase debugging: intake → investigate → analyze → research → fix plans → select → implement → verify.

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
  - "Ja, start onderzoek (Aanbevolen)" — Start parallel agent investigation
  - "Nee, correctie nodig" — Meer details of correcties geven

If "Nee" → ask for corrections, update summary, re-confirm.

---

## FASE 2: Codebase Investigation

Launch 3 agents in parallel:

| Agent                  | Focus          | Input                                      |
| ---------------------- | -------------- | ------------------------------------------ |
| debug-error-tracer     | Error origin   | Stack trace, error message, exception flow |
| debug-change-detective | Recent changes | Git history, recent commits affecting area |
| debug-context-mapper   | Code context   | Related files, dependencies, data flow     |

Each receives: problem summary + relevant file paths + error messages/stack traces.

---

## FASE 3: Root Cause Analysis

Analyze:

1. List findings from each agent
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
