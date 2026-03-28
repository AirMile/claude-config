# Technique: TDD (Test-Driven Development)

## Filosofie

**Kernprincipe**: tests verifiëren gedrag via public interfaces, niet implementatiedetails. Code mag volledig veranderen — tests niet.

**Goede tests** zijn integration-style: ze testen echte code paths via public APIs. Ze beschrijven _wat_ het systeem doet, niet _hoe_. Een goede test leest als een specificatie.

```typescript
// Goed — test observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

**Slechte tests** zijn gekoppeld aan implementatie. Ze mocken interne collaborators, testen private methods, of verifiëren via externe middelen.

```typescript
// Slecht — test implementatiedetails
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

**Rode vlaggen:** test breekt bij refactor terwijl gedrag niet veranderd is. Test naam beschrijft HOW, niet WHAT.

```typescript
// Slecht — omzeilt interface om te verifiëren
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// Goed — verifieert via interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

## Anti-pattern: Horizontal Slices

**NIET alle tests eerst schrijven, dan alle code.** Dit is "horizontal slicing" — RED als "schrijf alle tests" en GREEN als "schrijf alle code."

```
FOUT (horizontaal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

GOED (verticaal):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

Tests in bulk testen _denkbeeldig_ gedrag, niet _werkelijk_ gedrag. Je commit je aan teststructuur voordat je de implementatie begrijpt. Elke cycle bouwt voort op wat je leerde van de vorige.

## Single Requirement Workflow

### Step 1: Write Test (RED)

Lees 1 bestaand test bestand (bij voorkeur model/service test) voor setup/teardown patronen (before/after hooks, DB lifecycle, import conventies). Gebruik dit als basis voor je test structuur.

Genereer test voor DIT requirement. Volg project test conventies.
Run test — verwacht FAIL. Als test meteen slaagt — je test bestaand gedrag. Pas de test aan.

### Step 2: Implement (GREEN)

Schrijf minimale code om de test te laten slagen. Context7 research indien nodig.
Run test — verwacht PASS.

### Step 3: Refactor

**Nooit refactoren terwijl RED.** Eerst naar GREEN.

Zoek naar refactor candidates:

- **Duplicatie** → extract function/class
- **Shallow modules** → combineer of verdiep (zie [interface design](references/interface-design.md))
- **Feature envy** → verplaats logica naar waar de data leeft
- **Primitive obsession** → introduceer value objects
- **Bestaande code** die de nieuwe code onthult als problematisch

Run test — bevestig nog steeds PASS.

### Per-Cycle Checklist

```
[ ] Test beschrijft behavior, niet implementation
[ ] Test gebruikt alleen public interface
[ ] Test overleeft interne refactor
[ ] Code is minimaal voor deze test
[ ] Geen speculatieve features toegevoegd
[ ] Hergebruikt bestaande project utilities waar mogelijk
```

### Output

```
REQ-XXX: {description}
RED:      FAIL ({reason})
GREEN:    PASS
REFACTOR: PASS
SYNC:    {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```

## Referenties

- [Mocking richtlijnen](references/mocking.md) — wanneer wel/niet mocken, DI patronen
- [Interface design](references/interface-design.md) — deep modules, testbaarheidsregels
