# Interface Design voor Testbaarheid

## Deep vs Shallow Modules

Uit "A Philosophy of Software Design":

**Deep module** = kleine interface + veel implementatie (goed)

```
┌─────────────────────┐
│   Small Interface   │  ← Weinig methods, simpele params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complexe logica verborgen
│                     │
└─────────────────────┘
```

**Shallow module** = grote interface + weinig implementatie (vermijd)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Veel methods, complexe params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Geeft alleen door
└─────────────────────────────────┘
```

Bij het ontwerpen, vraag:

- Kan ik het aantal methods verminderen?
- Kan ik de parameters versimpelen?
- Kan ik meer complexiteit verbergen?

## Drie regels voor testbaarheid

### 1. Accepteer dependencies, maak ze niet aan

```typescript
// Testbaar
function processOrder(order, paymentGateway) {}

// Niet testbaar
function processOrder(order) {
  const gateway = new StripeGateway();
}
```

### 2. Retourneer resultaten, vermijd side effects

```typescript
// Testbaar
function calculateDiscount(cart): Discount {}

// Niet testbaar
function applyDiscount(cart): void {
  cart.total -= discount;
}
```

### 3. Klein oppervlak

- Minder methods = minder tests nodig
- Minder parameters = simpelere test setup
- Minder public API = minder kans op misbruik
