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
