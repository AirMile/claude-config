# Coding Rules

General and TypeScript coding standards. Loaded by dev-ship (build phase, always), and dev-ship's verify and refactor phases (frontend projects also load `shared/FRONTEND-RULES.md`).
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

## Testing Rules

Empirically grounded in MSR 2026 (Hora & Robbes): AI coding agents add mocks in 36% of test commits vs 26% for humans (χ²=505.5, p<0.001) and use mono-type `mock` in 95% of cases where humans vary (mock 91%, fake 57%, spy 51%). These rules mitigate that observation. Enforced at write time by `/dev-ship (build phase)` TDD (test-first per REQ).

### MUST_DO (Critical)

| ID     | Rule                                           | Check                                                                                    |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TST001 | Never mock anything except external boundaries | `vi.mock` / `jest.mock` only for: third-party APIs, file system, network, env vars, time |
| TST002 | Tests assert behavior, not implementation      | mockRatio (impl-coupled / total asserts) < 0.6 — checked in PHASE 5d                     |
| TST003 | Property-tests for boundary REQs               | REQ with `acceptance[].category: "boundary"` → checklist item `kind: "property"` + seed  |

#### Examples

**TST001** Mock only external boundaries

```ts
// ✗ Incorrect — mocks one of your own pure functions
vi.mock("./utils/format-price");
test("displays formatted price", () => {
  vi.mocked(formatPrice).mockReturnValue("€9,99");
  expect(render(<Price value={999} />)).toContain("€9,99");
});

// ✓ Correct — use the real function, mock only the external boundary
import { formatPrice } from "./utils/format-price";
test("displays formatted price from API", async () => {
  server.use(http.get("/api/price", () => HttpResponse.json({ cents: 999 })));
  const r = await render(<Price />);
  expect(r.getByText(formatPrice(999))).toBeVisible();
});
```

**TST002** Behavior over implementation

```ts
// ✗ Incorrect — verifies that a function was called
test("checkout calls paymentService", async () => {
  const spy = vi.spyOn(paymentService, "process");
  await checkout(cart);
  expect(spy).toHaveBeenCalledWith(cart.total);
});

// ✓ Correct — verifies that the system does the right thing
test("checkout confirms order with payment success", async () => {
  const result = await checkout(cart, validPayment);
  expect(result.status).toBe("confirmed");
  expect(result.orderId).toMatch(/^ord_/);
});
```

### SHOULD_DO (High)

| ID     | Rule                                               | Rationale                                                                                |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TST101 | Prefer fake/spy over mock for collaborator realism | In-memory fakes catch integration bugs that mocks miss. Spies observe without replacing. |
| TST102 | Pin seeds for non-deterministic code               | `vi.useFakeTimers`, seeded RNG (`seedrandom`), MSW for network — see TST201              |

### AVOID (Medium)

| ID     | Pattern                                       | Alternative                                                         |
| ------ | --------------------------------------------- | ------------------------------------------------------------------- |
| TST201 | Retry flag as permanent flake mitigation      | Fix root cause (timers, RNG, isolation). Retry hides bugs.          |
| TST202 | Snapshot-only test without behavior assertion | Combine snapshot with `toBe`/`toEqual` on key fields                |
| TST203 | `expect(x).toBeDefined()` as happy path       | Replace with `expect(x).toBe(specific-value)` — catches subtle bugs |

---

## Pipelines (two separate tracks)

**Design pipeline (appearance):**

```
Path A — Build with Claude Code:
/design-create (Build) → /design-ship

Path B — Brief for Claude Design / Figma:
/design-create (Brief) → [external design] → /design-create (Convert) → /design-ship
```

- Works standalone — no dev-pipeline required
- Fits: design-system work, static sites, portfolios, everything without business-logic features
- Output: code directly to repo (Build) or markdown handoff (Brief)
- PAGE/COMPONENT TODOs live exclusively on the **Design track** in the backlog
- `/design-ship` PASS is terminal for design cards — no refactor step
- Cross-pipeline coupling runs exclusively via `feature.json#frontend.linkedEntities[]` and `dependencies[]`

**Dev pipeline (functionality):**
`/project-plan → /dev-ship`

- Works standalone — no design-create required
- Fits: features with logic/state/tests, also backend-only
- `/dev-ship (build phase)` reads `design.pages[]/design.components[]` as visual spec source if present
- FEATURE/API/UI/etc. TODOs live exclusively on the **Dev track** in the backlog

**Cross-pipeline coupling:**

A card is either design (PAGE/COMPONENT) or dev — never both. For pages/components with handler-props without implementation: gap-discovery (`/design-create` Build/Convert routes) suggests a separate FEATURE-todo on the Dev track. The relationship is tracked via `feature.json#frontend.linkedEntities[]`.
