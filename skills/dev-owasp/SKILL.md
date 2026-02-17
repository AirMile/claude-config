---
name: dev-owasp
description: Complete OWASP Top 10:2025 security audit with parallel agents. Use with /dev-owasp to scan for security vulnerabilities in web applications.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# OWASP Security Audit

Full OWASP Top 10:2025 scan: scope → 10 parallel scanners → aggregated report → 3 fix strategies → implement.

## FASE 1: Scope

### Step 1: Detect tech stack

Scan project for languages, frameworks, and entry points:

- Glob for `package.json`, `requirements.txt`, `composer.json`, `go.mod`, `Cargo.toml`, `Gemfile`
- Identify framework (Express, Django, Laravel, Rails, Next.js, etc.)
- Map source directories (controllers, routes, API handlers, middleware)

### Step 2: Confirm scope

AskUserQuestion:

- header: "Scan Scope"
- question: "Welke delen van de codebase wil je scannen?"
- options:
  - "Volledige codebase (Aanbevolen)" — Scan alles behalve node_modules/vendor/dist
  - "Alleen backend/API" — Focus op server-side code
  - "Specifieke map" — Geef een pad op
- multiSelect: false

### Step 3: Build file list

Collect relevant source files (exclude dependencies, build output, static assets).
Group by type: routes/controllers, models/data, config, middleware, templates/views.

---

## FASE 2: Parallel Scan

Launch 10 scanner agents in parallel via Task tool:

| Agent             | Category                    | Risk     |
| ----------------- | --------------------------- | -------- |
| owasp-a01-scanner | Broken Access Control       | CRITICAL |
| owasp-a02-scanner | Security Misconfiguration   | HIGH     |
| owasp-a03-scanner | Supply Chain Failures       | HIGH     |
| owasp-a04-scanner | Cryptographic Failures      | HIGH     |
| owasp-a05-scanner | Injection                   | CRITICAL |
| owasp-a06-scanner | Insecure Design             | MEDIUM   |
| owasp-a07-scanner | Authentication Failures     | HIGH     |
| owasp-a08-scanner | Data Integrity Failures     | MEDIUM   |
| owasp-a09-scanner | Logging & Alerting Failures | MEDIUM   |
| owasp-a10-scanner | Exceptional Conditions      | MEDIUM   |

Each agent receives:

- Tech stack summary
- File list (grouped by type)
- Project root path

Each agent returns structured output with: category score (/10), positives, findings (file, line, severity, confidence, issue, fix, CWE), verdict.

Run all 10 in background. Collect results when all complete.

---

## FASE 3: Aggregation & Report

Use `mcp__sequentialthinking__sequentialthinking` to:

1. Collect all 10 category scores
2. Calculate overall security score (weighted average — CRITICAL categories x1.5 weight)
3. Filter findings: discard confidence < 60%
4. Group findings by severity: CRITICAL → HIGH → MEDIUM → LOW
5. Count totals per severity

Present consolidated report:

```
OWASP SECURITY AUDIT
Project: [name]
Tech Stack: [detected]
Files Scanned: [count]

Overall Security Score: [X.X]/10

| Category                  | Score | Findings   |
| ------------------------- | ----- | ---------- |
| A01 Broken Access Control | X/10  | N findings |
| A02 Security Misconfig    | X/10  | N findings |
| ...                       |       |            |

Summary:
CRITICAL: [N] | HIGH: [N] | MEDIUM: [N] | LOW: [N]

TOP CRITICAL/HIGH FINDINGS:
1. [severity] [category] — [issue] — [file:line]
2. ...
```

AskUserQuestion:

- header: "Volgende stap"
- question: "Wil je een fix plan genereren voor de gevonden issues?"
- options:
  - "Ja, genereer fix plans (Aanbevolen)" — 3 parallelle fix strategieen
  - "Nee, alleen het rapport" — Stop hier met het audit rapport
- multiSelect: false

If "Nee" → stop. Show report + reference to rerun with `/dev-legacy-owasp` later.

---

## FASE 4: Fix Plans

Launch 3 fix agents in parallel via Task tool:

| Agent               | Philosophy             | Scope                               |
| ------------------- | ---------------------- | ----------------------------------- |
| owasp-fix-minimal   | "Hotfix critical only" | CRITICAL findings, smallest changes |
| owasp-fix-pragmatic | "Pragmatic balance"    | CRITICAL + HIGH, grouped by file    |
| owasp-fix-extensive | "Full remediation"     | All findings + preventive measures  |

Each receives: aggregated scan results with all findings, severity counts, file references.

---

## FASE 5: Selection & Implementation

### Step 1: Present options

Show all 3 plans side by side:

```
FIX STRATEGIES
|          | Minimal       | Pragmatic   | Extensive   |
| -------- | ------------- | ----------- | ----------- |
| Fixes    | [N]           | [N]         | [N]         |
| Files    | [N]           | [N]         | [N]         |
| Effort   | [est]         | [est]       | [est]       |
| Risk     | Low           | Medium      | Medium-High |
| Coverage | CRITICAL only | CRIT + HIGH | All         |
```

### Step 2: Select strategy

AskUserQuestion:

- header: "Fix Strategie"
- question: "Welke fix strategie wil je toepassen?"
- options:
  - "Pragmatic (Aanbevolen)" — CRITICAL + HIGH, goede balans
  - "Minimal" — Alleen CRITICAL, laagste risico
  - "Extensive" — Alles, inclusief preventieve maatregelen
- multiSelect: false

### Step 3: Implement

Apply selected fix plan. Per fix: show file:line, apply change, verify syntax.

### Step 4: Summary

```
OWASP AUDIT COMPLETE
Score: [before] → estimated [after]
Strategy: [chosen]
Fixes applied: [N]
Files modified: [N]
Remaining items: [N] (deferred)
```

---

## Best Practices

### Language

Follow the Language Policy in CLAUDE.md.
