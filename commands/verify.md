---
description: Quick verification - typecheck + lint (optional tests)
---

# Verify Skill

## Overview

Quick verification command for fast sanity checks. Standalone command - use anytime during development.

**Trigger**: `/verify`

## When to Use

- During development, between edits
- Before committing changes
- As a quick sanity check

**NOT for:**
- Full feature verification with requirements (use /3-verify)

## Workflow

### FASE 1: SELECT MODE

**Goal:** Let user choose verification depth.

**Use AskUserQuestion:**
- header: "Verify Mode"
- question: "Which verification level do you want to run?"
- options:
  - label: "Quick (Recommended)", description: "Typecheck + lint (~10 sec)"
  - label: "Full", description: "Typecheck + tests + lint (~60 sec)"
  - label: "Explain", description: "Explain the difference"
- multiSelect: false

**Response handling:**
- "Quick" → Set mode: QUICK, proceed to FASE 2
- "Full" → Set mode: FULL, proceed to FASE 2
- "Explain" → Explain, then repeat question

**If "Explain":**
```
**Verify Modes**

- **Quick**: Typecheck and lint only. Fast (~10 sec),
  finds type errors and code style issues.

- **Full**: Typecheck, tests, and lint. Thorough (~60 sec),
  also finds broken tests.
```

---

### FASE 2: RUN VERIFICATION

**Goal:** Execute verification based on stack from CLAUDE.md.

**Read stack from CLAUDE.md** (## Project → Stack field)

**Execute commands based on stack:**

| Stack | Quick | Full |
|-------|-------|------|
| Node.js/TypeScript | `npm run typecheck && npm run lint` | `npm run typecheck && npm run test && npm run lint` |
| Laravel/PHP | `./vendor/bin/phpstan analyse && ./vendor/bin/pint --test` | `+ ./vendor/bin/pest` |
| Python | `mypy . && ruff check .` | `+ pytest` |

**If verify:quick/verify:full scripts exist, prefer those:**
```bash
npm run verify:quick  # or verify:full
```

**Parse output:**
- Count errors vs warnings
- Extract file:line locations

---

### FASE 3: REPORT RESULTS

**If ALL pass:**
```
✅ VERIFICATION PASSED

| Check | Status |
|-------|--------|
| TypeScript | ✓ Pass |
| Lint | ✓ Pass |
[If Full:] | Tests | ✓ 24/24 |

Ready to commit!
```

**If ANY fail:**
```
❌ VERIFICATION FAILED

| Check | Status |
|-------|--------|
| TypeScript | ✗ 3 errors |
| Lint | ✓ Pass |

Errors:
1. src/cart/Cart.tsx:23 - Type 'string' not assignable to 'number'
2. src/cart/Cart.tsx:45 - Property 'items' does not exist
3. src/api/client.ts:67 - Cannot find module './types'

Fix errors and run /verify again.
```

---

## Restrictions

This command must NEVER:
- Modify code (only report issues)
- Skip error reporting

This command must ALWAYS:
- Read stack from CLAUDE.md
- Report errors with file:line locations
