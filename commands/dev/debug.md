---
description: Systematic debugging with parallel agents and fix options
---

# Debug Skill

## Overview

Debug skill for systematic problem-solving. Activated with `/debug` command.

This skill guides through a structured debugging workflow: understanding the problem through targeted questions, investigating the codebase with parallel agents, performing root cause analysis with sequential thinking, researching solutions via Context7, presenting multiple fix strategies for user selection, and verifying the fix with automated and manual tests.

## When to Use

**Trigger:** `/debug` command

**Use this skill when:**
- Runtime errors or exceptions occur
- Build or compilation failures
- Unexpected behavior (code runs but wrong output)
- Performance issues (slow, hanging, memory leaks)
- Test failures
- Intermittent/flaky issues

**User triggers examples:**
- "De login werkt niet meer"
- "Build faalt met error X"
- "Deze functie returned verkeerde data"
- "App crasht bij het openen van pagina Y"
- "Tests falen sinds laatste commit"

## Workflow

### FASE 1: Problem Understanding

**Goal:** Clearly understand what's going wrong through sequential modals.

**Process:**

#### Step 1: Problem Classification

Use AskUserQuestion tool:
- header: "Probleem Type"
- question: "Wat voor type probleem is dit?"
- options:
  - label: "Runtime Error (Aanbevolen als je foutmeldingen ziet)"
    description: "Crashes, exceptions, error messages in console of UI"
  - label: "Logic Bug"
    description: "Verkeerde output, unexpected behavior, code werkt maar doet iets fout"
  - label: "Performance Issue"
    description: "Traag, memory leaks, timeouts, hoge CPU/memory usage"
  - label: "Integration Issue"
    description: "API failures, data sync problems, externe systemen werken niet"
  - label: "Vraag uitleggen"
    description: "Leg uit wat deze classificatie betekent"
- multiSelect: false

Store the answer as `problemType` for Step 2.

#### Step 2: Targeted Questions (based on problemType)

**If Runtime Error:**
Use AskUserQuestion tool:
- header: "Error Details"
- question: "Welke informatie heb je over de error?"
- options:
  - label: "Ik heb een error message (Aanbevolen)"
    description: "Ik kan de exacte foutmelding delen"
  - label: "Ik heb een stack trace"
    description: "Ik kan de volledige stack trace delen"
  - label: "Ik heb beide"
    description: "Error message en stack trace beschikbaar"
  - label: "Ik heb alleen een screenshot"
    description: "Visuele weergave van de error"
  - label: "Vraag uitleggen"
    description: "Leg uit wat error messages en stack traces zijn"
- multiSelect: false

Then ask user to share the error details.

**If Logic Bug:**
Use AskUserQuestion tool:
- header: "Gedrag Details"
- question: "Beschrijf het verschil tussen verwacht en werkelijk gedrag:"
- options:
  - label: "Ik weet exact wat er fout gaat (Aanbevolen)"
    description: "Ik kan expected vs actual behavior beschrijven"
  - label: "Output is verkeerd"
    description: "Functie/component geeft verkeerde waarde of weergave"
  - label: "Actie werkt niet"
    description: "Button, form, of interactie doet niet wat het zou moeten"
  - label: "Data klopt niet"
    description: "Verkeerde data wordt getoond of opgeslagen"
  - label: "Vraag uitleggen"
    description: "Leg uit wat ik moet beschrijven"
- multiSelect: false

Then ask for specific expected vs actual behavior.

**If Performance Issue:**
Use AskUserQuestion tool:
- header: "Performance Details"
- question: "Wanneer treedt het performance probleem op?"
- options:
  - label: "Bij specifieke actie (Aanbevolen)"
    description: "Probleem bij bepaalde pagina, button click, of data load"
  - label: "Altijd traag"
    description: "Hele applicatie is consistent traag"
  - label: "Na verloop van tijd"
    description: "Start snel, wordt langzamer (memory leak symptom)"
  - label: "Bij veel data"
    description: "Alleen traag met grote datasets of veel items"
  - label: "Vraag uitleggen"
    description: "Leg uit welke details relevant zijn"
- multiSelect: false

Then ask about scale/context details.

**If Integration Issue:**
Use AskUserQuestion tool:
- header: "Integratie Details"
- question: "Welk extern systeem is betrokken?"
- options:
  - label: "REST API (Aanbevolen)"
    description: "HTTP endpoints, fetch calls, axios requests"
  - label: "Database"
    description: "Supabase, Firebase, of andere database connectie"
  - label: "Third-party service"
    description: "Auth provider, payment, analytics, etc."
  - label: "File system / Storage"
    description: "Uploads, downloads, cloud storage"
  - label: "Vraag uitleggen"
    description: "Leg uit wat integratie issues zijn"
- multiSelect: false

Then ask for specific API/service details and error responses.

#### Step 3: Summary & Confirmation

Summarize understanding (in user's preferred language):
```
📋 PROBLEEM SAMENVATTING:

Type: [problemType from Step 1]
Symptoom: [what's going wrong based on Step 2]
Context: [when/where it happens]
Details: [specific info gathered in Step 2]
```

Use AskUserQuestion tool for confirmation:
- header: "Samenvatting Bevestiging"
- question: "Klopt deze probleem samenvatting?"
- options:
  - label: "Ja, start onderzoek (Aanbevolen)"
    description: "Start parallel agent investigation op basis van deze samenvatting"
  - label: "Nee, correctie nodig"
    description: "Ik geef meer details of correcties"
  - label: "Vraag uitleggen"
    description: "Leg uit wat deze bevestigingsstap betekent"
- multiSelect: false

Response handling:
- If "Ja, start onderzoek": continue to FASE 2
- If "Nee, correctie nodig": ask for corrections and update summary

---

### FASE 2: Codebase Investigation (Parallel Agents)

**Goal:** Investigate the codebase from 3 angles simultaneously.

**Process:**
Launch 3 agents in parallel with Task tool:

| Agent | Focus | Prompt includes |
|-------|-------|-----------------|
| debug-error-tracer | Error origin | Stack trace, error message, exception flow |
| debug-change-detective | Recent changes | Git history, recent commits affecting area |
| debug-context-mapper | Code context | Related files, dependencies, data flow |

Each agent receives:
- Problem summary from FASE 1
- Relevant file paths (if known)
- Error messages/stack traces (if available)

**Output:** Wait for all 3 agents to complete, collect findings.

---

### FASE 3: Root Cause Analysis (Sequential Thinking)

**Goal:** Combine findings and identify root cause.

**Process:**
Use `mcp__sequential-thinking__sequentialthinking` to:

1. List findings from each agent
2. Identify patterns and correlations
3. Form hypotheses about root cause
4. Evaluate each hypothesis against evidence
5. Determine most likely root cause
6. Identify knowledge gaps → what to research in FASE 4

**Output (in user's preferred language):**
```
🔍 [ROOT CAUSE ANALYSIS header]:

[Findings]:
- Error tracer: [key finding]
- Change detective: [key finding]
- Context mapper: [key finding]

[Hypothesis]: [most likely root cause]
[Confidence]: [high/medium/low]

[Research needed]: [specific topics for Context7]
```

---

### FASE 4: Context7 Research

**Goal:** Research solutions based on root cause analysis.

**Process:**
1. Use `mcp__Context7__resolve-library-id` to find relevant libraries
2. Use `mcp__Context7__get-library-docs` with specific topics:
   - Known bugs or issues
   - Best practices for this scenario
   - Recommended patterns/solutions

**Focus areas based on root cause:**
- If dependency issue → library version docs, migration guides
- If pattern misuse → correct usage examples, anti-patterns
- If edge case → error handling patterns, validation approaches

**Output:** Synthesize research findings relevant to the fix.

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Research complete"
```

---

### FASE 5: Fix Plan Generation (3 Parallel Agents)

**Goal:** Generate 3 fix strategies with different approaches.

**Process:**
Launch 3 agents in parallel with Task tool:

| Agent | Philosophy | Focus |
|-------|------------|-------|
| fix-minimal | "Kleinste wijziging" | Hotfix, minimal risk, fewest changes |
| fix-thorough | "Volledige fix" | Address root cause, add tests, clean up |
| fix-defensive | "Preventief" | Add safeguards, validation, prevent recurrence |

Each agent receives:
- Root cause analysis from FASE 3
- Research findings from FASE 4
- Affected code files

Each agent returns:
- Specific changes with file:line references
- Risk assessment (low/medium/high)
- Estimated scope (files affected)
- Trade-offs of this approach

---

### FASE 6: Plan Selection

**Goal:** Present options and get user approval.

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Fix options ready"
```

**Output (in user's preferred language):**
```
🔧 [FIX OPTIONS header]:

┌─────────────────────────────────────────────────────────┐
│ [OPTION] 1: MINIMAL                                     │
├─────────────────────────────────────────────────────────┤
│ [Approach]: [description]                               │
│ [Changes]: [X files, Y lines]                           │
│ [Risk]: LOW                                             │
│ Trade-off: [what you give up]                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [OPTION] 2: THOROUGH                                    │
├─────────────────────────────────────────────────────────┤
│ [Approach]: [description]                               │
│ [Changes]: [X files, Y lines]                           │
│ [Risk]: MEDIUM                                          │
│ Trade-off: [what you give up]                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [OPTION] 3: DEFENSIVE                                   │
├─────────────────────────────────────────────────────────┤
│ [Approach]: [description]                               │
│ [Changes]: [X files, Y lines]                           │
│ [Risk]: LOW-MEDIUM                                      │
│ Trade-off: [what you give up]                           │
└─────────────────────────────────────────────────────────┘

[Recommendation]: [recommended option based on context]
```

#### Step 1: Strategy Selection

Use AskUserQuestion tool:
- header: "Fix Strategie"
- question: "Welke fix aanpak wil je gebruiken?"
- options:
  - label: "Minimal (Aanbevolen voor productie)"
    description: "Kleinste wijziging om het probleem op te lossen, laag risico"
  - label: "Thorough"
    description: "Volledige fix die de root cause aanpakt met tests"
  - label: "Defensive"
    description: "Voeg safeguards en validatie toe om herhaling te voorkomen"
  - label: "Vraag uitleggen"
    description: "Leg het verschil tussen de strategieen uit"
- multiSelect: false

Store the answer as `selectedStrategy`.

#### Step 2: Fix Selection (MultiSelect)

Based on `selectedStrategy`, present the specific fixes from that strategy.

**Generate options dynamically from the chosen strategy's agent output:**

Use AskUserQuestion tool:
- header: "Fixes Selecteren"
- question: "Welke fixes wil je toepassen uit de [selectedStrategy] strategie?"
- options: (generated from agent output, examples below)

  **Example for Minimal strategy:**
  - label: "Fix 1: [specific change] (Aanbevolen)"
    description: "[file:line] - [what it does]"
  - label: "Fix 2: [specific change]"
    description: "[file:line] - [what it does]"
  - label: "Alle fixes toepassen"
    description: "Pas alle voorgestelde fixes uit Minimal toe"
  - label: "Vraag uitleggen"
    description: "Leg uit wat elke fix doet"

  **Example for Thorough strategy:**
  - label: "Fix 1: [core fix] (Aanbevolen)"
    description: "[file:line] - [what it does]"
  - label: "Fix 2: [add test]"
    description: "[test file] - [what it tests]"
  - label: "Fix 3: [cleanup]"
    description: "[file:line] - [what it cleans up]"
  - label: "Alle fixes toepassen"
    description: "Pas alle voorgestelde fixes uit Thorough toe"
  - label: "Vraag uitleggen"
    description: "Leg uit wat elke fix doet"

  **Example for Defensive strategy:**
  - label: "Fix 1: [core fix] (Aanbevolen)"
    description: "[file:line] - [what it does]"
  - label: "Fix 2: [add validation]"
    description: "[file:line] - [validation logic]"
  - label: "Fix 3: [add error handling]"
    description: "[file:line] - [error handling]"
  - label: "Fix 4: [add safeguard]"
    description: "[file:line] - [safeguard logic]"
  - label: "Alle fixes toepassen"
    description: "Pas alle voorgestelde fixes uit Defensive toe"
  - label: "Vraag uitleggen"
    description: "Leg uit wat elke fix doet"

- multiSelect: true

Store selected fixes as `selectedFixes`.

Response handling:
- If user selects specific fixes: apply only those fixes in FASE 7
- If user selects "Alle fixes toepassen": apply all fixes from the strategy
- Pass `selectedFixes` to FASE 7 for implementation

---

### FASE 7: Implementation

**Goal:** Execute the selected fixes from FASE 6.

**Input:**
- `selectedStrategy` from FASE 6 Step 1
- `selectedFixes` from FASE 6 Step 2

**Process:**
1. Apply only the `selectedFixes` from the chosen strategy
2. Use Edit tool for modifications
3. Follow the exact steps from the chosen agent's plan for each selected fix
4. Document each change made with file:line references
5. Skip fixes that were not selected by user

---
