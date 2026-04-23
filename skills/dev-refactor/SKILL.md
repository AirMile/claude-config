---
name: dev-refactor
description: Batch refactor code quality after testing with parallel analysis, dynamic stack-aware patterns, and early-exit for clean features. Use with /dev-refactor to improve code structure, naming, and patterns.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.1.0
  category: dev
---

# Refactor

## Overview

Optional quality step on completed features. Not a status-gate — features are DONE after `/dev-verify`. This skill improves code structure, naming, and patterns on already-finished features.

Batch-first architecture: analyzes ALL features in parallel via Explore agents, triages clean vs dirty, generates stack-aware refactor patterns via Context7, creates one combined plan with one approval, and applies changes with per-feature rollback.

**Trigger**: `/dev-refactor` or `/dev-refactor {feature-name}`

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `feature.json` → `files[]` — these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- **Exception:** New utility/helper files may be **created** if they exclusively extract code from pipeline files (e.g., extracting shared logic into a new `utils/` file). Existing external files may NEVER be modified.
- If a pattern scan or research finding points to an external file → skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file → only refactor the pipeline file side

This rule exists because refactoring external files risks breaking other features and creates unpredictable side effects.

## When to Use

- After `/dev-verify` completes (features in DONE status)
- When `.project/features/{name}/feature.json` exists met `tests` sectie
- NOT for: fixing bugs (/dev-verify), adding features (/dev-define), planning (/dev-define)

## Input

Reads `.project/features/{feature-name}/feature.json` — unified feature file met requirements, architecture, files, build, tests secties.

## Output Structure

```
.project/features/{feature-name}/
└── feature.json           # Enriched: refactor section, status updated
```

## Two Research Layers

```
.claude/research/
├── stack-baseline.md          ← EXISTING: library conventions/patterns/pitfalls
│                                 (React hooks, Tailwind v4, GSAP cleanup, etc.)
│                                 Read in FASE 2 for research decision
│
└── refactor-patterns.md       ← NEW: stack-specific code smells & anti-patterns
                                  Generated via Context7 on first refactor
                                  Reused on subsequent refactors
```

**stack-baseline.md** = "how to use these libraries correctly" (conventions)
**refactor-patterns.md** = "what mistakes to look for in code using these libraries" (anti-patterns)

## Workflow

### FASE 0: Batch Context Loading + Refactor Patterns

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`):
   - Filter DONE features: `data.features.filter(f => f.status === "DONE")`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` sectie
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)

2. **Determine feature queue:**

   **a) Feature name provided** (`/dev-refactor auth`):
   - Validate feature exists in `.project/features/`
   - Feature queue = `[auth]` (regardless of refactor status)

   **b) No feature name** (`/dev-refactor`):
   - Present scope selection via **AskUserQuestion**:
     - header: "Scope"
     - question: "Wat wil je refactoren?"
     - options:
       - label: "Nog niet gerefactorde features (Recommended)", description: "{N} features: {feature1}, {feature2}, ..."
       - label: "Alle DONE features", description: "Alle {M} DONE features, inclusief eerder gerefactorde"
       - label: "Hele codebase", description: "Scan alle source files, niet feature-gebonden"
     - multiSelect: false
   - If "Nog niet gerefactorde features" → feature queue = unrefactored DONE features
   - If "Alle DONE features" → feature queue = all DONE features
   - If "Hele codebase" → **codebase mode** (see below)
   - If 0 unrefactored features: toon "Alle features zijn al gerefactord" in de optie beschrijving

   **c) "recent"**: find most recently modified `feature.json` with `tests` sectie, queue = `[that feature]`

   **Codebase mode** ("Hele codebase"):
   - Pipeline files = alle source bestanden uit project (detecteer `src/` of equivalent uit `project-context.json` `context.structure`, of CLAUDE.md)
   - Exclude: `node_modules/`, `.project/`, test files, config files
   - Geen feature.json schrijven — resultaat opslaan in `.project/session/codebase-refactor.json`
   - Commit message: `refactor(codebase): {summary}`
   - Skip FASE 5 feature.json/backlog updates — alleen commit + rapport

3. **Load ALL feature docs for every feature in queue:**

   For each feature, read `feature.json` — bevat requirements, architecture, files, build, tests secties.

   Validate `tests` sectie exists in `feature.json` for each feature. If missing → remove from queue and warn.

4. **Build pipeline files list per feature:**

   For each feature, extract all code file paths from `feature.json`:
   - Parse `files[]` array (each entry has `path`, `type`, `action`)
   - Store as `pipeline_files[feature_name]`

4b. **Load project conventions** (optioneel):

Lees `.project/project-context.json` (als bestaat). Extract `context.patterns`.

Als beschikbaar: voeg toe aan Explore agent prompt in FASE 1 onder
`PROJECT CONVENTIONS:` sectie. Helpt agents onderscheid maken tussen
"intentioneel project pattern" en "code smell". Eén van de patterns kan een
`Code maturity: ...` string zijn (zie `shared/DASHBOARD.md` voorbeelden) die
de refactor-agressie stuurt — die wordt automatisch meegegeven omdat hij deel
uitmaakt van `patterns`.

4c. **Build pipeline diff per feature** (optioneel, skip voor codebase-mode):

Voor elke feature met een bekend build-startmoment: bouw een diff-string die agents als focus-hint krijgen.

```bash
# Bepaal begin van feature-werk
first_hash=$(git log --since="{feature.build.startedAt}" --pretty=format:"%H" -- {pipeline_files} | tail -1)

# Diff van die commit tot nu, gescoped tot pipeline files
[ -n "$first_hash" ] && git diff ${first_hash}^..HEAD -- {pipeline_files} > /tmp/diff-{feature}.patch
```

Opslaan als `pipeline_diff[feature_name]`. Als diff leeg is of `startedAt` ontbreekt: skip — agent ziet dan alleen de volledige files.

5. **Load or generate refactor-patterns.md:**

   ```
   IF .claude/research/refactor-patterns.md exists:
     → Load cached patterns, skip Context7
     → Log: "Refactor patterns loaded (cached)"

   IF NOT exists:
     → Detect stack from CLAUDE.md ### Stack section
     → For each library/framework in stack:
        Context7 resolve-library-id → query-docs:
        "Common code smells, anti-patterns, and refactoring opportunities
         in {library} projects. Focus on: performance pitfalls, security
         anti-patterns, common mistakes, and code organization issues."
     → Compile results into .claude/research/refactor-patterns.md
     → Log: "Refactor patterns generated via Context7 ({N} libraries)"
   ```

   **Format for refactor-patterns.md:**

   ```markdown
   # Refactor Patterns

   <!-- Generated via Context7 for: {stack list} -->
   <!-- Regenerate: delete this file and run /dev-refactor -->

   ## {Library Name}

   ### Performance Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ### Security Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ### Code Organization Anti-patterns

   - {pattern}: {description} — {what to look for in code}
   ```

**Output:**

```
BATCH CONTEXT LOADED

| Metric | Value |
|--------|-------|
| Features in queue | {N} |
| Total pipeline files | {sum across all features} |
| Refactor patterns | {cached / generated via Context7} |

Features:
{for each feature:}
- {name}: {M} pipeline files

→ Starting parallel analysis...
```

---

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"refactor","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

### FASE 1: Parallel Three-Lens Analysis + Triage

**Goal:** Per feature drie focused Explore agents parallel (reuse / quality / efficiency), dan merge + triage naar CLEAN vs HAS_FINDINGS.

**Waarom drie lenses:** één monolithische prompt met 6 categorieën verdunt focus en produceert noise. Drie aparte lenses geven scherpere findings per domein. Geleerd uit `/simplify`-runs — zie plan in `.claude/plans/` (2026-04).

**Lens-definities** (zie ook `shared/PATTERNS.md` als aanwezig):

- **Reuse lens**: DRY binnen pipeline files, duplicatie met bestaande helpers/utilities in de codebase, inline logica die bestaande lib/stdlib kan gebruiken, extract-opportunities
- **Quality lens**: security (injection/XSS/deserialization), cold-reader readability (locality, abstraction-levels, unit-naming, cognitive load, silent errors), control-flow smells (nesting/ternary/dense), over-engineering, stringly-typed, dode code, redundante state, leaky abstractions, RULES.md violations, stack-specific anti-patterns
- **Efficiency lens**: missed concurrency (Promise.all), N+1, hot-path bloat, memory leaks, unbounded maps, TOCTOU, overly broad ops, no-op recurring updates

Security blijft in Quality-lens (aparte security-agent is overkill; voor diepe security-review bestaat `dev-owasp`).

1. **Bepaal lens-strategie per feature:**
   - `pipeline_files[feature].length < 4` → **single-lens mode**: één gecombineerde agent met alle drie lenses in de prompt (splitten levert te weinig signaal voor te veel token-overhead)
   - `length >= 4` → **three-lens mode**: drie agents parallel per feature

   **Concurrency-budget:** max 10 concurrent agents totaal. Als `sum(lens_count_per_feature) > 10`: batch features in groepen. Bijv. 5 features × 3 lenses = 15 → batch 3 features eerst (9 agents), dan de rest.

   **Model-default:** alle lens-agents draaien op Sonnet. Haiku-switch voor Reuse-lens is een toekomstige optimalisatie — niet activeren zonder A/B-meting op finding-kwaliteit.

2. **Launch agents IN PARALLEL** volgens lens-strategie.

   **Universele prompt-header** (elke lens, elke mode krijgt deze):

   ````
   Feature: {feature-name}
   Pipeline files:
   {list of pipeline_files paths}

   {if pipeline_diff[feature] exists:}
   FOCUS HINT — deze regels zijn nieuw/gewijzigd in deze feature; scan
   met voorrang (maar rapporteer issues in andere regels óók):
   ```diff
   {pipeline_diff[feature]}
   ````

   {/if}

   PROJECT CONVENTIONS:
   {context.patterns of "niet beschikbaar — gebruik CLAUDE.md als fallback"}
   Als een pattern consistent is met project conventions → NIET rapporteren.
   Let op: een pattern met prefix "Code maturity:" geeft aan hoe agressief je mag refactoren — respecteer de daarin genoemde houding (bv. geen over-abstractions voor student/prototype projecten).

   DISCIPLINE:
   - Max 500 woorden output. Kort, scherp, direct.
   - Geen nitpicks. Alleen issues met duidelijke, concrete fix.
   - Skip false positives expliciet (noem ze niet eens).
   - Formaat per finding: `[IMPACT|CATEGORY] file:line — probleem — concrete fix in 1 zin`
   - Geen "Geen X gevonden" regels voor lege categorieën.
   - Alleen pipeline files scannen — externe files negeren.

   ```

   **Lens-specifieke body** — kies één van drie (of alle drie gecombineerd in single-lens mode):

   **(A) REUSE lens body:**

   ```

   LENS: Reuse

   Scan voor:
   - Duplicate code blocks (>5 regels identiek binnen pipeline files)
   - Vergelijkbare logica patronen (>70% gelijkheid, 3+ locaties)
   - Inline logica die een bestaande helper/utility/stdlib kan vervangen
   - Herhaalde conditionals, copy-paste met kleine variatie

   VOORBEELDEN:
   ✓ Report: 3 tools met identieke JSON.stringify({text, sources}) wrapping → extract `formatResult()` helper
   ✓ Report: hand-rolled `lstrip/rstrip + regex` waar `path.basename()` bestaat
   ✗ Skip: twee functies met 3 vergelijkbare regels (te klein voor abstractie, zeker bij `Code maturity: student`)
   ✗ Skip: abstractie die maar 2× gebruikt wordt en de call-sites niet duidelijker maakt

   ```

   **(B) QUALITY lens body:**

   ```

   LENS: Quality

   Scan voor:
   SECURITY:
   - Injection: exec(, eval(, new Function, os.system
   - XSS: .innerHTML =, dangerouslySetInnerHTML, document.write
   - Deserialization: pickle.loads op untrusted data
   - GitHub Actions: ${{ github.event. in run: commands

   CLARITY & QUALITY:
   - Control-flow smells: nested 3+ niveaus, ternary chains (a ? x : b ? y), dense one-liners → early returns / if-else / guards / lookup table
   - Names encode units/ownership/lifetime: `timeoutMs` niet `t`, `rawHtml` vs `safeHtml`, `userIdOwned` niet `id`. Primitives zonder unit in naam = smell.
   - Dode code / unused exports
   - Onnodige comments (WHAT ipv WHY, task-references, narrating)
   - Redundante state (state die afgeleid kan worden)
   - Stringly-typed code waar constants/enums bestaan
   - Error-handling smells: over-defensive try/catch rond code die niet kan falen, OF silent swallowing (catch {}, `?? ""` dat missing data verbergt, unwrap zonder trace)
   - Leaky abstractions / internal details geëxposed
   - RULES.md violations — Algemeen + TypeScript secties (R007-R008, T001-T203)
   - Stack-specific anti-patterns uit refactor-patterns.md

   COLD-READER (kan een nieuwe lezer dit begrijpen zonder 3 files open te zetten?):
   - Locality of behavior: non-triviale regel vereist >2 file-jumps om intent te snappen → relocate of rename inline
   - God-object params: functie neemt Request/Context/Session maar leest <3 velden → destructure of expliciete primitieve params
   - Mixed abstraction levels: SQL + business-rule + HTTP-header mangling in één functie → splits policy van mechanism
   - Shallow abstractions: helper waarvan signature even complex is als body, 1 caller, geen naming-win → inline
   - Cognitive overload: >5 mutable locals+flags+loop-indices live in deepste blok → splits functie of bundel state in record
   - Cross-file decision-duplication: dezelfde enum/switch-ladder in 3+ plaatsen → 1 source of truth (NB: overlap met Reuse-lens → dedup bij merge in FASE 1 stap 4)

   VOORBEELDEN:
   ✓ Report: `msg.constructor.name === "HumanMessage"` i.p.v. `isHumanMessage(msg)` typeguard
   ✓ Report: dode exported functie zonder callers (leeg body met TODO-comment)
   ✓ Report: 4-niveau nested if/else waar early-returns het vlak maken
   ✓ Report: `function charge(ctx)` leest alleen `ctx.userId` + `ctx.amount` → `charge(userId, amount)`
   ✓ Report: `const t = 5000` → `const timeoutMs = 5000`
   ✓ Report: 7 mutable locals in één loop-body, lezer verliest overzicht → extract state-record of splits loop
   ✗ Skip: comment die een niet-obvious invariant uitlegt (WHY is waardevol)
   ✗ Skip: expliciete intermediate variabele i.p.v. inline expression (clarity > compact, naming als documentatie)
   ✗ Skip: thin adapter aan framework-seam (middleware, Express handler) — shallowness IS de taak
   ✗ Skip: context-param waar framework-contract het vereist (middleware signature)

   ```

   **(C) EFFICIENCY lens body:**

   ```

   LENS: Efficiency

   Scan voor:
   - Missed concurrency: onafhankelijke awaits sequentieel i.p.v. Promise.all
   - N+1: loops met DB/API calls per iteratie
   - Hot-path bloat: blocking werk op startup of per-request/per-render
   - Memory leaks: unbounded Maps/arrays, ontbrekende cleanup, event listener leaks
   - Recurring no-op updates in polling/intervals/event handlers
   - Unnecessary existence checks (TOCTOU: pre-check file/resource voor je 'm gebruikt)
   - Overly broad: hele files lezen als stuk volstaat, alle items laden om er één te filteren
   - Redundante computations / repeated file reads

   VOORBEELDEN:
   ✓ Report: `for (const c of chars) await loadBackstory(c)` → `Promise.all(chars.map(loadBackstory))`
   ✓ Report: `userStore` Map die per-user groeit zonder TTL/LRU
   ✓ Report: `similaritySearch(q, 8).filter(...).slice(0, 3)` → filter-callback arg van de store
   ✗ Skip: O(n) loop over 5-item array (micro-optimization zonder impact)
   ✗ Skip: JSON.stringify in een niet-hot-path debug log

   ```

   **Single-lens mode** (feature met <4 files): voeg alle drie bodies samen onder één agent, behoud DISCIPLINE-regels. Eén output-blok met alle findings.

   ```

3. **Output format** (elke lens-agent retourneert):

   ```
   ANALYSIS_START
   FEATURE: {name}
   LENS: reuse | quality | efficiency | combined
   STATUS: CLEAN | HAS_FINDINGS
   ARCHITECTURE: libs={list} | patterns={list} | uncovered={list or "-"}

   FINDINGS:
   - [HIGH|SEC] path/to/file.js:42 — probleem-omschrijving — concrete fix
   - [MED|DRY] a.js:10 ↔ b.js:55 — probleem — fix
   - [LOW|CLARITY] c.js:120 — probleem — fix

   SKIPPED (balance):
   - path:line — korte rationale waarom bewust niet gerapporteerd

   POSITIVES:
   - observation
   ANALYSIS_END
   ```

   **Impact-tags:** `HIGH` (security, breaking bug, memory leak), `MED` (DRY, efficiency, clarity op hot-path), `LOW` (cosmetisch, micro-clarity).
   **Category-tags:** `SEC`, `DRY`, `EFF`, `CLARITY`, `OVERENG`, `STACK`.

4. **Merge lens-outputs per feature:**

   Voor three-lens features: combineer de drie FINDINGS-lijsten tot één lijst. Dedup op `file:line + fix` (zelfde issue door meerdere lenses gespot → 1 entry, categorie-tags mergen).

   STATUS per feature = `CLEAN` als alle drie lenses `CLEAN`, anders `HAS_FINDINGS`.

5. **Parsing agent results:**

   Per agent:
   1. Zoek `ANALYSIS_START..ANALYSIS_END` in TaskOutput
   2. Als truncated: Grep in output-file, Read met offset
   3. Extract STATUS + FINDINGS + SKIPPED

6. **Triage:**
   - **CLEAN**: STATUS = CLEAN (0 findings merged)
   - **HAS_FINDINGS**: 1+ findings merged

   CLEAN features → **early-exit**, skip FASE 2-4.

7. **If ALL features CLEAN** → jump direct naar FASE 5 (geen approval).

**Output:**

```
PARALLEL ANALYSIS COMPLETE

| Feature | Pipeline Files | Status | Findings |
|---------|---------------|--------|----------|
| {name1} | {N} | CLEAN | 0 |
| {name2} | {M} | HAS_FINDINGS | {X} |
| ... | ... | ... | ... |

Summary: {clean_count} clean, {findings_count} with findings

{if all clean:}
→ All features clean! Skipping to completion...

{if has findings:}
→ Proceeding with {findings_count} feature(s) to research decision...
```

---

### FASE 2: Aggregated Research Decision

**Goal:** One research decision for all affected features combined (not per-feature).

**Steps:**

1. **Aggregate architecture info from all HAS_FINDINGS features:**
   - Collect all libraries mentioned in ARCHITECTURE sections
   - Collect all "Uncovered libraries" (not in refactor-patterns.md or stack-baseline.md)
   - Compute: `uncovered = used_libraries - baseline_libraries - refactor_pattern_libraries`

2. **Read stack baseline:**
   - Read `.claude/research/stack-baseline.md` (if exists)
   - Note which technologies are already documented

3. **Decide: is Context7 research needed?**

   | Signal                                                 | Research needed?                        |
   | ------------------------------------------------------ | --------------------------------------- |
   | Stack baseline + refactor-patterns cover all libraries | NO                                      |
   | Findings are concrete, directly actionable             | NO                                      |
   | Uncovered libraries found in analysis                  | YES — research those specific libraries |
   | Complex security concerns (auth, crypto, injection)    | YES — research security best practices  |
   | No stack baseline exists at all                        | YES — research core stack patterns      |

   **If research NOT needed** → proceed directly to FASE 3.

   **If research needed** → spawn one Explore agent (`subagent_type: Explore`, thoroughness: "very thorough") to do all research in an isolated context. This keeps Context7 results out of the main session.

   Determine which research domains to include based on findings:

   | Domain         | Include when                                        |
   | -------------- | --------------------------------------------------- |
   | Security       | Security patterns found OR auth/crypto/input flows  |
   | Performance    | N+1 patterns, heavy loops, or caching opportunities |
   | Quality        | Complex abstractions or unclear patterns            |
   | Error handling | Missing error handling in critical paths            |

   Agent prompt — include only domains identified as needed:

   ```
   Research best practices for a refactoring task.

   Tech stack: {from CLAUDE.md}
   Stack baseline: {from stack-baseline.md, or "none"}

   Aggregated analysis:
   {ANALYSIS_START..ANALYSIS_END blocks from all HAS_FINDINGS features}

   {If security domain needed:}
   SECURITY:
   - resolve-library-id + query-docs for: {relevant frameworks}
   - Focus: input validation, auth patterns, injection prevention, OWASP

   {If performance domain needed:}
   PERFORMANCE:
   - resolve-library-id + query-docs for: {relevant frameworks}
   - Focus: N+1 queries, caching, eager loading, indexing, resource usage

   {If quality domain needed:}
   QUALITY:
   - resolve-library-id + query-docs for: {relevant frameworks}
   - Focus: design patterns, SOLID, DRY, complexity reduction

   {If error-handling domain needed:}
   ERROR HANDLING:
   - resolve-library-id + query-docs for: {relevant frameworks}
   - Focus: exception patterns, retry logic, graceful degradation

   RETURN FORMAT:
   RESEARCH_START
   Security: {3-5 bullet points: vulnerabilities found, best practices, framework features}
   Performance: {3-5 bullet points: optimization patterns, caching strategies, query fixes}
   Quality: {3-5 bullet points: design patterns, refactoring approaches, conventions}
   Error handling: {3-5 bullet points: exception patterns, resilience, logging}
   RESEARCH_END

   Only include sections for domains you were asked to research.
   ```

   **If uncovered libraries found** → also update refactor-patterns.md:
   - Context7 query for each uncovered library
   - Append new sections to existing refactor-patterns.md

**Output:**

Parse the agent's `RESEARCH_START...END` block. Display:

```
RESEARCH DECISION

| Source | Libraries Covered |
|--------|------------------|
| stack-baseline.md | {list} |
| refactor-patterns.md | {list} |
| Uncovered | {list or "none"} |

{if no research:}
Research: Skipped (existing knowledge sufficient)

{if research:}
Research: Explore agent ({domains researched})
Refactor patterns updated: {yes/no}

→ Ready for combined plan.
```

---

### FASE 3: Combined Plan + Single Approval

**Goal:** One plan combining ALL findings from ALL affected features, one user approval (tenzij `--quick` pad).

**Steps:**

1. **Create ranked improvements list:**

   Combine all findings from all HAS_FINDINGS features:
   - **Cross-feature deduplication**: same pattern in multiple files → 1 plan item with multiple locations
   - Each improvement gets impact level: 🔴 HIGH / 🟡 MED / 🟢 LOW (mapped van `[IMPACT|CATEGORY]` tags uit FASE 1 findings)
   - Sort: HIGH first (security, breaking bug, memory leak), then MED (performance, DRY, efficiency), then LOW (clarity, quality, simplification)
   - **Only pipeline files** may be included
   - Group by feature for clarity

2. **Aggregate SKIPPED (balance) entries** from all lens-agents per feature.

   Dedup op `file:line + rationale`. Deze lijst toont de user wat de skill bewust **niet** wil fixen — zodat ze kunnen overriden ("fix die toch wel").

3. **Evaluate `--quick` auto-apply pad:**

   **Trigger:**
   - Expliciet: `/dev-refactor --quick {feature}` in gebruikersinput
   - Auto-detect: ALL van deze condities tegelijk waar:
     - Queue bevat precies 1 feature
     - 0 HIGH-findings (geen SEC, geen breaking-risk)
     - ≤ 5 total findings (na dedup)
     - Geen uncovered libraries in ARCHITECTURE-blok
     - Geen `Code maturity: library` pattern in `context.patterns` — library-projecten krijgen altijd approval

   **Gedrag bij quick-pad:**
   - Skip de AskUserQuestion in stap 5
   - Toon het plan + SKIPPED-lijst als informatieve output
   - Spring direct naar FASE 4 met scope = "Alles toepassen"
   - FASE 5 commit-message prefixt `refactor(quick)` i.p.v. `refactor(batch)`/`refactor({feature})`
   - Toon "revert"-hint in de completion-output: `Revert: /rewind <hash>` met saved_hash uit FASE 4

   Bij elke expliciete `--quick` die niet aan auto-condities voldoet: **vallen terug** op normale approval-flow + warn in output waarom (bv. "--quick genegeerd: 2 HIGH findings gevonden").

4. **Present improvements with before/after code:**

   ```
   REFACTOR PLAN ({N} features, {M} improvements)

   🔴 HIGH: [X] improvements (security, breaking risk)
   🟡 MED: [Y] improvements (performance, DRY, efficiency)
   🟢 LOW: [Z] improvements (clarity, simplification)

   ── {feature-1} ──

   1. 🔴 {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   2. 🟡 {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   ── {feature-2} ──

   3. 🟡 {file}:{line} — {issue} → {fix}
      ...

   ── Bewust niet gefixt ──
   - {file:line} {pattern} — {korte rationale}
   - {file:line} {pattern} — {korte rationale}
   (skip deze sectie als 0 SKIPPED entries)

   ──────────────────

   Files to be modified: [count]
   - {file1} ([N] changes) — {feature}
   - {file2} ([M] changes) — {feature}

   Per-feature rollback: YES (feature A succeeds, B fails → only B rolled back)

   {if quick-pad active:}
   ⚡ QUICK MODE — approval wordt overgeslagen, directe apply.
      Revert achteraf via /rewind.
   ```

5. **Ask for scope** (skip deze stap in quick-mode):

   Use **AskUserQuestion** tool:
   - header: "Scope"
   - question: "Welke verbeteringen wil je toepassen? ({M} totaal across {N} features)"
   - options:
     - label: "Alles toepassen (Recommended)", description: "Alle {M} verbeteringen in {N} features"
     - label: "Alleen HIGH + MED", description: "{X+Y} verbeteringen, skip LOW"
     - label: "Alleen HIGH", description: "{X} verbeteringen, alleen security/breaking"
     - label: "Per feature kiezen", description: "Selecteer per feature welke verbeteringen je wilt"
     - label: "Ook Bewust-niet-gefixt erbij", description: "Voeg de {K} SKIPPED items toe aan de plan"
   - multiSelect: false

   **If "Per feature kiezen"** → show per-feature AskUserQuestion with multiSelect:
   - header: "Features"
   - question: "Welke features wil je refactoren?"
   - options: one per feature with finding count
   - multiSelect: true

   **If "Ook Bewust-niet-gefixt erbij"** → toon SKIPPED-lijst in tweede AskUserQuestion (multiSelect) zodat user specifiek kan kiezen welke alsnog mee moeten, en promoteer die naar improvements.

   Only approved features proceed to FASE 4. Non-selected features get CLEAN status.

   De user kan ook "Annuleren" via de ingebouwde "Other" optie → EXIT met "Refactor geannuleerd door gebruiker".

---

### FASE 4: Apply + Test Per Feature

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

**Priority order for each feature (execute in this sequence):**

1. Security improvements
2. Performance optimizations
3. Efficiency improvements
4. DRY/Refactoring improvements
5. Simplification (remove over-engineering)
6. Clarity (readability improvements)
7. Code quality improvements
8. Error handling improvements

**Steps:**

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for global rollback
   ```

2. **For each feature with approved improvements:**

   a. **Track files for targeted rollback** (no git stash needed — file-level tracking is sufficient):

   Initialize empty lists: `modified_files[feature_name] = []`, `created_files[feature_name] = []`

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
   - **Only modify files in pipeline_files list** — assert before each edit
   - Keep changes non-breaking
   - Track: `modified_files[feature_name] = [list of existing files changed]`
   - Track: `created_files[feature_name] = [list of new files created]`

   c. **Run test suite after this feature's changes:**
   - Detect test command from CLAUDE.md `### Testing` section
   - **All pass** → mark feature as APPLIED, continue to next feature
   - **Any fail → analyze before rollback:**

     | Test failure type                                         | Action                     |
     | --------------------------------------------------------- | -------------------------- |
     | Test expects old behavior that was intentionally improved | Update test, re-run        |
     | Genuine regression (broke unrelated functionality)        | Rollback THIS feature only |
     | Flaky or environment-dependent                            | Re-run once, then decide   |

     **If test update needed:**
     - Update ONLY the specific assertion(s)
     - Re-run FULL test suite
     - If still failing → rollback THIS feature only
     - Max 1 test update attempt per failing test

     **Per-feature rollback (only this feature, not others):**

     ```bash
     git checkout -- {modified_files[feature_name]}
     rm -f {created_files[feature_name]}
     ```

     Mark feature as ROLLED_BACK with reason. Continue to next feature.

   d. **Report per feature:**

   ```
   ✓ {feature-name}: {N} improvements applied
   ```

   or:

   ```
   ✗ {feature-name}: rolled back ({reason})
   ```

**Non-breaking rule:**

- No API signature changes
- No database schema modifications
- No breaking parameter changes
- No removal of public methods/functions
- Preserve all existing behavior
- If breaking change needed → skip that improvement and note it

**Output:**

```
IMPROVEMENTS APPLIED

| Feature | Status | Improvements | Files Modified |
|---------|--------|-------------|----------------|
| {name1} | APPLIED | {N} | {M} |
| {name2} | APPLIED | {N} | {M} |
| {name3} | ROLLED_BACK | 0 | 0 ({reason}) |

→ Documenting results...
```

---

### FASE 5: Batch Completion

**Goal:** Proportional documentation, single backlog update, single commit.

1. **Write feature.json per feature** (read-modify-write):

   Als N > 1 features: lees alle `.project/features/{name}/feature.json` parallel, muteer elk in memory, schrijf alle parallel terug.

   Voeg `refactor` sectie toe per feature:

   **Altijd aanwezig in refactor:** `status`, `improvements` (object met categorieën), `decisions[]`, `positiveObservations[]`, `failureAnalysis`, `pendingImprovements[]`.

   **Per status variant:**
   - CLEAN: `refactor.status = "CLEAN"`, lege `improvements`, alleen `positiveObservations`
   - REFACTORED: `refactor.status = "REFACTORED"`, gevulde `improvements` per categorie, `decisions` met rationale
   - ROLLED_BACK: `refactor.status = "ROLLED_BACK"`, `failureAnalysis` (markdown string), `pendingImprovements[]`

   **Update top-level feature status:**
   - CLEAN: `status: "DONE"` (ongewijzigd)
   - REFACTORED: `status: "DONE"` (ongewijzigd)
   - ROLLED_BACK: `status: "DONE"` (ongewijzigd — refactor.status documenteert de rollback)

   Bestaande secties NIET overschrijven.

2. **Parallel sync** (backlog + dashboard + conditionele context sync) — volg `shared/SYNC.md` 3-File Sync Pattern, skill-specifieke mutaties hieronder:

   Lees parallel (skip als niet bestaat):
   - `.project/backlog.html`
   - `.project/project.json`
   - `.project/project-context.json`

   Muteer in memory:

   **Backlog** (zie `shared/BACKLOG.md`): status blijft `"DONE"` voor alle features (CLEAN, REFACTORED, en ROLLED_BACK). Zet `data.updated` naar huidige datum.

   **Dashboard** (zie `shared/DASHBOARD.md`):
   - Als packages gewijzigd (toegevoegd/verwijderd): merge naar `stack.packages`
   - Als endpoints gewijzigd: merge naar `endpoints`
   - Als data entities gewijzigd: merge naar `data.entities`
   - `features` array: status blijft `"DONE"` (ongewijzigd voor alle varianten)

   **Context sync (conditioneel, schrijf naar `project-context.json`)** — alleen als REFACTORED features structurele wijzigingen bevatten:

   Trigger als ANY: bestanden hernoemd/verplaatst, nieuwe bestanden via extractie, patterns fundamenteel gewijzigd.
   Skip als: alleen interne code quality, performance zonder structurele impact.

   Wanneer getriggerd (in project-context.json):
   - `context.structure` → overwrite full tree met gewijzigde file paths
   - Extracted components/hooks → add to structure tree
   - `context.patterns` → merge gewijzigde patterns
   - `context.updated` → huidige datum
   - `architecture.components` → update bestaande componenten (status, src, test, connects_to), voeg nieuwe toe als componenten zijn hernoemd/gesplitst. Volg component-first model uit `shared/DASHBOARD.md`.
   - Quality: only project-specific, non-obvious, one line per item
   - Log: `context: {N} updates ({keys touched})` of `context: no updates needed`

   Learning extraction gebeurt alleen in `/dev-verify`. Refactor-inzichten worden hier vastgelegd in `feature.json.refactor` — geen `learnings[]` append.

   Schrijf parallel terug:
   - Edit `backlog.html` (keep `<script>` tags intact)
   - Write `project.json` (stack, features, endpoints, data)
   - Write `project-context.json` (context, architecture — maak aan als niet bestaat)

3. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from FASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to `git add -A`.

   ```bash
   git commit -m "$(cat <<'EOF'
   refactor(batch): {summary}

   {N} features analyzed, {clean} clean, {refactored} refactored, {rolled_back} rolled back

   {for each REFACTORED feature:}
   - {feature}: {improvement count} improvements ({categories})
   {for each CLEAN feature:}
   - {feature}: clean (no changes needed)
   {for each ROLLED_BACK feature:}
   - {feature}: rolled back ({reason})
   EOF
   )"
   ```

   For single-feature commits, use the existing format:

   ```
   refactor({feature}): {summary}
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

4. **Show completion:**

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REFACTOR COMPLETE

   {N} feature(s) processed:
   {for each CLEAN feature:}
   ✓ {name} — clean (no changes needed)
   {for each REFACTORED feature:}
   ✓ {name} — {improvement-count} improvements applied
   {for each ROLLED_BACK feature:}
   ✗ {name} — rolled back ({reason})

   Refactoring complete. Features remain in DONE status.

   Next steps:
     1. /dev-define {next-feature} → volgende feature uit backlog
     2. /dev-plan → backlog herzien als scope gewijzigd is
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## Error Handling

### Context Loading Failures

**No features found** → exit: "Run /dev-define and /dev-build first"
**No test results for any feature** → exit: "Run /dev-verify first"
**Some features missing test results** → remove from queue, warn, continue with rest
**No files in feature** → skip feature, warn: "No code files found in feature.json for {feature}"

### Refactor Patterns Failures

**Context7 unavailable** → skip refactor-patterns generation, proceed with universal patterns only
**Partial Context7 results** → generate refactor-patterns.md with available data, note gaps
**CLAUDE.md has no ### Stack section** → skip stack-specific patterns, use universal only

### Analysis Failures

**Explore agent fails for a feature** → skip that feature, warn, continue with rest
**All Explore agents fail** → exit: "Analysis failed — try again or run on a single feature"
**Agent output truncated** → use Grep/Read to find ANALYSIS_START..ANALYSIS_END block

### Test Failures

**Tests fail after refactoring a feature** → per-feature rollback, continue with next feature
**Test framework not detected** → ask user which command to run
**Tests hang** → kill process, rollback current feature

### Rollback Failures

**git checkout fails for feature files** → report manual recovery steps:

1. Show the `saved_hash` from FASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: "Gebruik `/rewind` in Claude Code om terug te gaan naar een eerder punt"
4. STOP — do not attempt destructive recovery commands

## Restrictions

This skill must NEVER:

- Read pipeline source files directly in the main conversation (always use Explore agent)
- Pass full file contents to research agents (pass structured analysis from Explore agent)
- Analyze, plan, or modify files outside pipeline_files (extracted from feature.json)
- Include external file findings in any plan
- Proceed without existing tests section in feature.json
- Make breaking changes (API, schema, parameter changes)
- Over-simplify code by removing helpful abstractions or combining too many concerns
- Prioritize fewer lines over readability (explicit > compact)
- Create "clever" solutions that are hard to understand or debug
- Skip user approval at FASE 3 (unless 0 findings across all features)
- Skip test verification in FASE 4
- Proceed if tests fail without analyzing failure type first (stale test vs regression)
- Apply improvements without user scope selection
- Run Explore agents sequentially when multiple features are in the queue (use parallel)
- Create disproportionate documentation for clean features

This skill must ALWAYS:

- Enforce the pipeline_files scope boundary at every phase
- Launch Explore agents in parallel for batch analysis (max 10 concurrent)
- Triage features into CLEAN vs HAS_FINDINGS after analysis
- Early-exit CLEAN features (skip FASE 2-4)
- Use refactor-patterns.md for stack-aware analysis (generate on first run, cache thereafter)
- Aggregate research decisions across all features (1 decision, not N)
- Present ONE combined plan with ONE user approval for all features
- Deduplicate cross-feature findings (same pattern → 1 plan item)
- Apply per-feature rollback (feature A succeeds, feature B fails → only B rolled back)
- Write proportional documentation (compact for CLEAN, full for REFACTORED)
- Make a single commit for all features
- Re-read each file immediately before editing (prevents "File has not been read yet" errors)
- Group edits by file: read file → apply ALL edits for that file → next file
- Run full test suite after applying changes per feature
- Analyze test failures before rollback (distinguish stale tests from regressions)
- Apply balance filter: skip findings where the "fix" reduces readability for a cold reader (someone seeing the code for the first time)
- Check CLAUDE.md and `.project/project.json` context for project-specific conventions during analysis
