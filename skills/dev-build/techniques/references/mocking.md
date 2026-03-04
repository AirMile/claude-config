# Mocking Richtlijnen

## Wanneer mocken

Mock alleen op **system boundaries**:

- Externe APIs (payment, email, third-party services)
- Databases (soms — prefer test DB)
- Time / randomness
- File system (soms)

## Wanneer NIET mocken

- Eigen modules en classes
- Interne collaborators
- Alles wat je zelf beheert

**Rode vlag:** als je een mock schrijft voor code die je team heeft geschreven, test je waarschijnlijk implementation details.

## Dependency Injection

Pass externe dependencies in, maak ze niet intern aan:

```typescript
// Testbaar — mock paymentClient in tests
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Niet testbaar — hardcoded dependency
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

## SDK-style interfaces

Maak specifieke functies per externe operatie, niet één generieke fetcher:

```typescript
// Goed — elke functie is onafhankelijk mockbaar
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// Slecht — mock vereist conditionele logica
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

Voordelen SDK-style:

- Elke mock retourneert één specifieke shape
- Geen conditionele logica in test setup
- Type safety per endpoint
