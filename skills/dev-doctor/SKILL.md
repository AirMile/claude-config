---
name: dev-doctor
description: Diagnose codebase health with drift (8 languages) plus react-doctor for React projects. Generates stack-aware improvement plans. Use with /dev-doctor to scan code quality and plan fixes.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Doctor

Layered codebase health diagnosis: drift for general health (Go, TypeScript, Python, Rust, Java, Ruby, PHP, C#) plus react-doctor for React-specific depth (hooks, state, effects, security). Show combined report, then optionally generate a stack-aware improvement plan.

**Trigger**: `/dev:doctor`

## FASE 0: Detect & Scan

### Step 1: Detect project type

Determine which scanners to run:

```
IF go.mod exists         → lang = Go
IF Cargo.toml exists     → lang = Rust
IF pyproject.toml OR requirements.txt OR setup.py exists → lang = Python
IF pom.xml exists        → lang = Java
IF Gemfile exists        → lang = Ruby
IF composer.json exists  → lang = PHP
IF *.csproj exists       → lang = C#
IF package.json exists   → lang = TypeScript/JavaScript
  IF package.json contains "react" in dependencies → is_react = true
```

If none detected: exit with "No supported project detected. Drift supports: Go, TypeScript, Python, Rust, Java, Ruby, PHP, C#."

```
DETECTED

Project: {lang}
Scanners: drift{+ react-doctor if is_react}
```

### Step 2: Verify drift is installed

```bash
command -v drift >/dev/null 2>&1 && echo "installed" || echo "missing"
```

If missing, show install instructions and ask:

```
drift is not installed. Install options:

  brew install greatnessinabox/tap/drift
  curl -fsSL https://raw.githubusercontent.com/greatnessinabox/drift/main/install.sh | sh
  go install github.com/greatnessinabox/drift/cmd/drift@latest
```

Use **AskUserQuestion** tool:

- header: "Install"
- question: "drift is niet geinstalleerd. Wil je het nu installeren?"
- options:
  - label: "Homebrew (Recommended)", description: "brew install greatnessinabox/tap/drift"
  - label: "Shell script", description: "curl installer"
  - label: "Overslaan", description: "Alleen react-doctor draaien (als React project)"
- multiSelect: false

If "Overslaan" and not is_react: exit with "No scanners available."
If "Overslaan" and is_react: skip drift, continue with react-doctor only.

### Step 3: Run scanners

**Run drift** (if available):

```bash
drift 2>&1
```

Capture full output. Parse:

- **Overall health score** (weighted composite)
- **5 metrics**: Cyclomatic Complexity (30%), Dependency Freshness (20%), Architecture Boundaries (20%), Dead Code Detection (15%), AI Diagnostics (15%)
- **Per-metric scores** and trend indicators

**Run react-doctor** (if is_react):

```bash
npx -y react-doctor@latest . --verbose 2>&1
```

Capture full output. Parse:

- **Health score** (0–100)
- **Category results**: State & Effects, Performance, Architecture, Bundle Size, Security, Correctness, Accessibility, Dead Code, framework-specific
- **Individual findings** with file paths, line numbers, rule names, and severity

### Step 4: Display combined report

```
DOCTOR SCAN

{lang} Project — {scanner_count} scanner(s)

┌─ drift ─────────────────────────────────
│ Health Score: {score}
│
│ | Metric                  | Score | Weight |
│ |-------------------------|-------|--------|
│ | Cyclomatic Complexity   | {s}   | 30%    |
│ | Dependency Freshness    | {s}   | 20%    |
│ | Architecture Boundaries | {s}   | 20%    |
│ | Dead Code Detection     | {s}   | 15%    |
│ | AI Diagnostics          | {s}   | 15%    |
│
│ Findings: {N} issues
└──────────────────────────────────────────

{if is_react:}
┌─ react-doctor ───────────────────────────
│ Health Score: {score}/100 {GREAT / NEEDS WORK / CRITICAL}
│
│ | Category        | Findings |
│ |-----------------|----------|
│ | {cat1}          | {count}  |
│ | {cat2}          | {count}  |
│ | ...             | ...      |
│
│ Total: {N} findings across {M} categories
└──────────────────────────────────────────

COMBINED: {total_findings} findings from {scanner_count} scanner(s)
```

If 0 findings across all scanners: "Clean bill of health! No issues found." → EXIT.

### Step 5: Ask next step

Use **AskUserQuestion** tool:

- header: "Next"
- question: "{total_findings} findings gevonden. Wat wil je doen?"
- options:
  - label: "Verbeterplan genereren (Recommended)", description: "Plan mode met geprioriteerde fixes, verrijkt met stack-baseline"
  - label: "Alleen rapport bekijken", description: "Stop hier, je hebt de info die je nodig hebt"
- multiSelect: false

If "Alleen rapport bekijken" → EXIT.

## FASE 1: Stack Context Loading

1. **Load stack baseline** (if exists):
   - Read `.claude/research/stack-baseline.md`
   - Log: "Stack baseline loaded" or "Stack baseline not found"

2. **Read CLAUDE.md** for `### Stack` section:
   - Parse technologies and versions
   - If no Stack section: detect from project files (package.json deps, go.mod, Cargo.toml, pyproject.toml, etc.)

3. **Determine research gaps:**

   Collect all libraries/frameworks mentioned in scanner findings. Compare against stack baseline coverage.

   ```
   covered = libraries documented in stack-baseline
   uncovered = libraries in findings NOT in stack-baseline
   ```

4. **Context7 enrichment** (only if uncovered libraries exist):

   For each uncovered library:
   - `resolve-library-id` → `query-docs`:
     "Best practices, common mistakes, and performance patterns for {library}"
   - Store results as additional context for plan generation

   Log:

   ```
   STACK CONTEXT

   | Source             | Coverage                       |
   |--------------------|--------------------------------|
   | stack-baseline.md  | {covered list or "not found"}  |
   | Context7           | {enriched list or "skipped"}   |
   ```

## FASE 2: Generate Improvement Plan

1. **Enter plan mode** using the **EnterPlanMode** tool.

2. **Merge and deduplicate findings** from both scanners:
   - If drift and react-doctor report the same file/issue → merge into one finding, note both sources
   - Preserve source attribution: `[drift]`, `[react-doctor]`, or `[both]`

3. **Categorize and prioritize findings:**

   Priority order:
   1. Security (highest)
   2. Correctness
   3. Performance
   4. Cyclomatic Complexity
   5. State & Effects (React only)
   6. Architecture / Architecture Boundaries
   7. Dependency Freshness
   8. Bundle Size
   9. Accessibility
   10. Dead Code (lowest)

4. **Write plan** to the plan file with this structure:

   ```markdown
   # Doctor Improvement Plan

   ## Scores

   | Scanner      | Score       | Status   |
   | ------------ | ----------- | -------- |
   | drift        | {score}     | {status} |
   | react-doctor | {score}/100 | {status} |

   Target: {target scores after fixes}

   ## Summary

   | Priority | Category    | Findings | Source       |
   | -------- | ----------- | -------- | ------------ |
   | 1        | Security    | {N}      | {scanner(s)} |
   | 2        | Correctness | {N}      | {scanner(s)} |
   | ...      | ...         | ...      | ...          |

   ## Improvements

   ### {Priority 1}: {Category}

   #### {rule-name}: {description}

   - **Source**: [drift] / [react-doctor] / [both]
   - **Files**: {file:line}, {file:line}
   - **Issue**: {what was found}
   - **Fix**: {concrete fix approach}
   - **Stack context**: {relevant pattern from baseline/Context7, if applicable}

   {repeat per finding}

   ## Quick Wins

   {Findings that can be fixed in <5 minutes with low risk}

   ## Approach

   {Suggested order of execution — fix by category or by file proximity}
   ```

5. **Exit plan mode** using **ExitPlanMode** — user reviews and approves the plan.

## Error Handling

- **drift not installed**: offer install options, fall back to react-doctor only if React project
- **npx fails** (no network, npm issue): skip react-doctor, continue with drift results only
- **react-doctor on non-React project**: skip silently (drift handles it)
- **drift on unsupported project**: exit with supported languages list
- **Output parsing fails** (unexpected format): show raw output to user, skip plan generation
- **Context7 unavailable**: skip enrichment, generate plan with available context only
- **Both scanners fail**: exit with error details and suggest manual inspection

## Restrictions

This skill must NEVER:

- Modify any project files (this is a diagnostic + planning skill only)
- Skip showing the health score report before plan generation
- Enter plan mode without user consent
- Make assumptions about fix approaches without stack context
- Run react-doctor on non-React projects

This skill must ALWAYS:

- Run drift on every supported project
- Additionally run react-doctor when React is detected
- Deduplicate overlapping findings between scanners
- Show the combined report before asking about plan generation
- Use stack-baseline when available
- Enrich via Context7 when findings reference uncovered libraries
- Generate concrete, actionable fixes (not generic advice)
