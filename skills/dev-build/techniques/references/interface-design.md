# Interface Design for Testability

## Deep vs Shallow Modules

From "A Philosophy of Software Design":

**Deep module** = small interface + much implementation (good)

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing, ask:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity?

## Three rules for testability

### 1. Accept dependencies, don't create them

```typescript
// Testbaar
function processOrder(order, paymentGateway) {}

// Niet testbaar
function processOrder(order) {
  const gateway = new StripeGateway();
}
```

### 2. Return results, avoid side effects

```typescript
// Testbaar
function calculateDiscount(cart): Discount {}

// Niet testbaar
function applyDiscount(cart): void {
  cart.total -= discount;
}
```

### 3. Small surface area

- Fewer methods = fewer tests needed
- Fewer parameters = simpler test setup
- Fewer public API = less chance of misuse
