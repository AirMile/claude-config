# Coding Rules

General and TypeScript coding standards. Loaded by dev-build (always), dev-verify and dev-refactor (frontend projects also load `shared/FRONTEND-RULES.md`).
For frontend-specific rules (React, HTML/CSS, A11y, Performance), see `shared/FRONTEND-RULES.md`.

> **Scope:** General and TypeScript sections apply to all projects.

---

## Rule Categories

| Category      | Severity | Action on Violation     |
| ------------- | -------- | ----------------------- |
| **MUST_DO**   | CRITICAL | Blocks deployment/merge |
| **SHOULD_DO** | HIGH     | Requires justification  |
| **AVOID**     | MEDIUM   | Prefer alternatives     |

---

## General

### MUST_DO (Critical)

| ID   | Rule                                     | Rationale   | Check                                                     |
| ---- | ---------------------------------------- | ----------- | --------------------------------------------------------- |
| R007 | All async functions handle errors        | Reliability | try/catch or .catch() on promises                         |
| R008 | No secrets in client code                | Security    | No API keys, tokens in frontend bundles                   |
| R009 | Back completion claims with fresh output | Reliability | Run test/command again, read output, reference explicitly |

#### Examples

**R007** Async error handling

```ts
// ✗ Incorrect
async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// ✓ Correct
async function fetchUser(id: string) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw error;
  }
}
```

**R008** No secrets in client code

```ts
// ✗ Incorrect
const API_KEY = "sk-1234567890abcdef";
fetch(`https://api.example.com/data?key=${API_KEY}`);

// ✓ Correct
// Server-side (API route / server action)
const API_KEY = process.env.API_KEY;
fetch(`https://api.example.com/data?key=${API_KEY}`);
```

**R009** Evidence Before Claims

For every claim of "done", "works", "fixed", "passed", "ready":

1. **Identify**: which command/test/screenshot proves the claim?
2. **Execute**: run it fresh — do not use cached/previous output
3. **Read**: full output, exit code, error count
4. **Claim only after**: reference the output explicitly ("3/3 tests passed in run X")

Anti-patterns:

- `"Should work"` / `"probably fine"` / `"looks good"` without verification
- `"Done!"` / `"Great!"` before exit code has been read
- Reusing previous passing output after new edits
- Paraphrased claim ("looks fine") without underlying evidence

Also applies to delegation: before accepting a subagent report, verify that the report itself contains evidence (command + output), not just "succeeded".

---

## TypeScript Rules

### MUST_DO (Critical)

| ID   | Rule                | Check                                 |
| ---- | ------------------- | ------------------------------------- |
| T001 | Strict mode enabled | `tsconfig.json` strict: true          |
| T002 | No implicit any     | Explicit types                        |
| T003 | Null checks         | Optional chaining, nullish coalescing |

#### Examples

**T002** No implicit any

```ts
// ✗ Incorrect
function parse(data) {
  return data.name;
}

// ✓ Correct
function parse(data: UserPayload): string {
  return data.name;
}
```

**T003** Null checks

```ts
// ✗ Incorrect
const city = user.address.city;

// ✓ Correct
const city = user?.address?.city ?? "Unknown";
```

### SHOULD_DO (High)

| ID   | Rule                              | Rationale                 |
| ---- | --------------------------------- | ------------------------- |
| T101 | Discriminated unions for variants | Type narrowing            |
| T102 | Readonly where possible           | Immutability              |
| T103 | Generics for reusable code        | Type safety + flexibility |

### AVOID (Medium)

| ID   | Pattern                  | Alternative                  |
| ---- | ------------------------ | ---------------------------- |
| T201 | Type assertions (`as`)   | Type guards                  |
| T202 | Non-null assertion (`!`) | Optional chaining            |
| T203 | Enums                    | Const objects or union types |

---

## Pipelines (two separate tracks)

**Frontend pipeline (appearance):**

```
Path A — Build with Claude Code:
/frontend-design (Build) → /frontend-check

Path B — Brief for Claude Design / Figma:
/frontend-design (Brief) → [external design] → /frontend-convert → /frontend-check
```

- Works standalone — no dev-pipeline required
- Fits: design-system work, static sites, portfolios, everything without business-logic features
- Output: code directly to repo (Build) or markdown handoff (Brief)
- PAGE/COMPONENT TODOs live exclusively on the **Frontend track** in the backlog
- `/frontend-check` PASS is terminal for frontend cards — no refactor step
- Cross-pipeline coupling runs exclusively via `feature.json#frontend.linkedEntities[]` and `dependencies[]`

**Dev pipeline (functionality):**
`/project-backlog → /dev-define → /dev-build → /dev-verify → /dev-refactor`

- Works standalone — no frontend-design required
- Fits: features with logic/state/tests, also backend-only
- `/dev-build` reads `design.pages[]/design.components[]` as visual spec source if present
- FEATURE/API/UI/etc. TODOs live exclusively on the **Dev track** in the backlog

**Cross-pipeline coupling:**

A card is either frontend (PAGE/COMPONENT) or dev — never both. For pages/components with handler-props without implementation: gap-discovery (`/frontend-design`, `/frontend-convert`) suggests a separate FEATURE-todo on the Dev track. The relationship is tracked via `feature.json#frontend.linkedEntities[]`.
