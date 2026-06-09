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

## Pattern: Property-based testing for edge/boundary REQs

**When.** REQ has `acceptance[].category: "edge"` or `"boundary"` — those scenarios describe an _invariant_ over an input space, not a specific example. Example-based testing ("input = 42, expect = 84") leaves most of that space untested; property-based generates dozens to hundreds of inputs and checks the invariant.

**`happy` category stays example-based.** A concrete example reads better as a specification of the golden path. Reserve property-based for the generalizing criteria.

**Setup.** One-time: `npm i -D fast-check @fast-check/vitest`. The `@fast-check/vitest` bridge provides `test.prop()` and `it.prop()` with vitest-compatible modifiers.

**Form 1 — Full property test (replaces the example for edge/boundary REQs):**

```typescript
import { test, fc } from "@fast-check/vitest";

// REQ-005 (category: boundary): cart-total is commutative over item order
test.prop({ items: fc.array(fc.record({ id: fc.uuid(), price: fc.nat() })) })(
  "when items added in any order, then cart-total is identical",
  ({ items }) => {
    const a = createCart();
    items.forEach((i) => a.add(i));
    const b = createCart();
    [...items].reverse().forEach((i) => b.add(i));
    return a.total === b.total;
  },
);
```

**Form 2 — One-shot random inside a classic `test()`** (lighter adoption when full-prop feels like overkill):

```typescript
test("display-name contains first-name for arbitrary user", ({ g }) => {
  const user = {
    firstName: g(fc.string),
    lastName: g(fc.string),
    age: g(fc.integer, { min: 0, max: 120 }),
  };
  expect(computeDisplayName(user)).toContain(user.firstName);
});
```

**Seed-pinning is mandatory.** Otherwise every run is different and debugging becomes hell. Two options:

- **Per-test seed** (preferred for specific REQs): `test.prop([...], { seed: 4242, numRuns: 500 })`
- **Global** (in `test/setup.ts`): `fc.configureGlobal({ seed: Number(process.env.FC_SEED) || 12345 })`

On a counterexample, fast-check logs the seed + shrink path — pin that seed permanently in a regression test to cover the minimal counterexample for good.

**Anti-patterns:**

- ❌ `numRuns: 1000` without a reason — lengthens CI time with no coverage gain above ~200
- ❌ A property that merely rebuilds the implementation (`output === f(input) === implementation(input)`). The property must be an invariant independent of the implementation (`f(f(x)) === x` for reverse, `f(x).length >= x.length` for encode, etc.)
- ❌ Mixing property and example in the same test — split them

**Interaction with mutation testing.** Stryker (see `../../shared/MUTATION-TESTING.md`) and property-based are complementary: property-based kills more mutants because it tests more input variants. Expect a score boost on REQs where a property-based test was written. No action needed — observe only.

## References

- [Mocking guidelines](references/mocking.md) — when to mock and when not to, DI patterns
- [Interface design](references/interface-design.md) — deep modules, testability rules
- [@fast-check/vitest docs](https://github.com/dubzzz/fast-check/tree/main/packages/vitest) — generators, seeds, async properties
