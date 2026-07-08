# Mocking Guidelines

## When to mock

Mock only at **system boundaries**:

- External APIs (payment, email, third-party services)
- Databases (sometimes — prefer test DB)
- Time / randomness
- File system (sometimes)

## When NOT to mock

- Own modules and classes
- Internal collaborators
- Everything you own yourself

**Red flag:** if you write a mock for code your team wrote, you are probably testing implementation details.

## Dependency Injection

Pass external dependencies in, don't create them internally:

```typescript
// Testable — mock paymentClient in tests
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Not testable — hardcoded dependency
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

## SDK-style interfaces

Create specific functions per external operation, not one generic fetcher:

```typescript
// Good — every function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// Bad — mock requires conditional logic
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK-style advantages:

- Each mock returns one specific shape
- No conditional logic in test setup
- Type safety per endpoint

## Network boundary: MSW

For the "External APIs" boundary above, prefer intercepting at the network level over mocking your
own SDK wrapper — the app under test makes a real `fetch` call and is unaware it's mocked, so the
mock can't silently drift from the real HTTP contract while a wrapper mock still passes.

```typescript
// npm i -D msw
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw"; // MSW v2 — not the old v1 `rest.*` API

const server = setupServer(
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Ada" }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Per-test override for an error-state test:
test("shows an error when the user fetch fails", async () => {
  server.use(
    http.get("/api/users/:id", () => new HttpResponse(null, { status: 500 })),
  );
  // ... exercise the code path that calls this endpoint
});
```

Decision rule: a real HTTP call over the wire → MSW (network boundary). An internal module you own
that wraps I/O → DI/`vi.mock` (see above).

## Time and randomness

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01"));
});

afterEach(() => {
  vi.useRealTimers(); // skipping this leaks fake time into later tests
});
```

Runner portability: Jest has the identical shape (`jest.useFakeTimers()` / `jest.setSystemTime()`).
node:test has no built-in fake-timer API (experimental `mock.timers`, or an external lib) — don't
assume `vi.*` exists on a non-vitest project.
