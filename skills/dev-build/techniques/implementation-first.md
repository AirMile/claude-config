# Technique: Implementation First

## Varianten

- **Implementation First** (default): implementeer, dan test
- **Implementation Only**: implementeer zonder automated tests. Alleen bij duidelijke reden (zie onder).

## Single Requirement Workflow

### Step 1: Implement

Implement THIS requirement fully. Context7 research if needed.
Verify it works (manual check or quick run).

### Step 2: Write Test

Generate test for the implemented requirement.
Run test — fix implementation if FAIL.

**Skip bij Implementation Only** — ga direct naar output.

### Output

**Implementation First:**

```
REQ-XXX: {description}
IMPLEMENTED: {what was built}
TESTED: PASS
Files: {files created/modified}
SYNC:  {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

**Implementation Only:**

```
REQ-XXX: {description}
IMPLEMENTED: {what was built}
TESTED: SKIPPED ({reason})
Files: {files created/modified}
SYNC:  {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

## Implementation Only: Toegestane Redenen

Gebruik alleen wanneer automated tests geen waarde toevoegen:

| Reden         | Wanneer                                                    |
| ------------- | ---------------------------------------------------------- |
| `visual-only` | Pure styling, layout, CSS, visuele effecten, particles     |
| `config-only` | Env vars, route registratie, package config, static assets |
| `prototype`   | Bewust tijdelijke code, throwaway MVP                      |

Het requirement krijgt wél een manueel checklist-item in `tests.checklist[]` (FASE 3B).
De reden wordt gelogd in `feature.json` per requirement als `skipTestReason`.
