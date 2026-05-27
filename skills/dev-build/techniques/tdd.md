# Technique: TDD (Test-Driven Development)

## Philosophy

**Core principle**: tests verify behavior via public interfaces, not implementation details. Code may change completely — tests do not.

**Good tests** are integration-style: they test real code paths via public APIs. They describe _what_ the system does, not _how_. A good test reads like a specification.

```typescript
// Goed — test observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify via external means.

```typescript
// Slecht — test implementatiedetails
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

**Red flags:** test breaks during refactor while behavior has not changed. Test name describes HOW, not WHAT.

```typescript
// Bad — bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// Good — verifies via interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

## Anti-pattern: Horizontal Slices

**DO NOT write all tests first, then all code.** This is "horizontal slicing" — RED as "write all tests" and GREEN as "write all code."

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

CORRECT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

Tests in bulk test _imaginary_ behavior, not _actual_ behavior. You commit to a test structure before you understand the implementation. Each cycle builds on what you learned from the previous one.

## Single Requirement Workflow

### Step 1: Write Test (RED)

Read 1 existing test file (preferably a model/service test) for setup/teardown patterns (before/after hooks, DB lifecycle, import conventions). Use this as the basis for your test structure.

Generate a test for THIS requirement. If the requirement has `acceptance[]`: use `when` as the test description (`it("when {when}, {then}", ...)`) and `then` as the expected result in the assert. No `acceptance[]` → follow project test conventions.
Run test — expect FAIL. If the test passes immediately — you are testing existing behavior. Adjust the test.

### Step 2: Implement (GREEN)

Write minimal code to make the test pass. Context7 research if needed.
Run test — expect PASS.

### Step 3: Refactor

**Never refactor while RED.** Go to GREEN first.

Look for refactor candidates:

- **Duplication** → extract function/class
- **Shallow modules** → combine or deepen (see [interface design](references/interface-design.md))
- **Feature envy** → move logic to where the data lives
- **Primitive obsession** → introduce value objects
- **Existing code** that the new code reveals as problematic

Run test — confirm still PASS.

### Per-Cycle Checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses only public interface
[ ] Test survives internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
[ ] Reuses existing project utilities where possible
```

### Output

```
REQ-XXX: {description}
RED:      FAIL ({reason})
GREEN:    PASS
REFACTOR: PASS
SYNC:    {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

## Pitfalls

### Testing module-level side effects (env-loaders, singletons, config)

When a module **throws or computes on import** (e.g. `assertEnv()` at top level, a singleton client, a config object built from `process.env`), each test needs a fresh module instance. The module cache otherwise locks in the first import's state across all tests.

**Doesn't work** — query-strings don't bypass the resolver:

```ts
delete process.env.PROJECT_ID;
await import("./env?missing-project"); // ❌ same cached module, no throw
```

**Does work** — `vi.resetModules()` + per-test env-reset:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("env-loader", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws when PROJECT_ID is missing", async () => {
    delete process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    await expect(import("./env")).rejects.toThrow(/PROJECT_ID/);
  });
});
```

For Jest: same pattern with `jest.resetModules()`.

**When to apply:** the module body contains `process.env` reads, side-effectful initialisation, or singleton construction. Pure functions don't need this — top-level test-file imports are fine.

## References

- [Mocking guidelines](references/mocking.md) — when to mock and when not to, DI patterns
- [Interface design](references/interface-design.md) — deep modules, testability rules
