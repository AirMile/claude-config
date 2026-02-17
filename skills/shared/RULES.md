# Coding Rules

Coding standards met severity categorieën voor validation.

> **Scope:** Algemeen en TypeScript secties gelden voor alle projecten.
> React/Next.js en HTML/CSS secties zijn frontend-specifiek.

---

## Rule Categorieën

| Categorie     | Severity | Actie bij Violation        |
| ------------- | -------- | -------------------------- |
| **MUST_DO**   | CRITICAL | Blokkeert deployment/merge |
| **SHOULD_DO** | HIGH     | Vereist justificatie       |
| **AVOID**     | MEDIUM   | Prefereer alternatieven    |

---

## Algemeen

### MUST_DO (Critical)

| ID   | Rule                               | Rationale   | Check                                     |
| ---- | ---------------------------------- | ----------- | ----------------------------------------- |
| R007 | Alle async functies handlen errors | Reliability | try/catch of .catch() op promises         |
| R008 | Geen secrets in client code        | Security    | Geen API keys, tokens in frontend bundles |

#### Voorbeelden

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

**R008** Geen secrets in client code

```ts
// ✗ Incorrect
const API_KEY = "sk-1234567890abcdef";
fetch(`https://api.example.com/data?key=${API_KEY}`);

// ✓ Correct
// Server-side (API route / server action)
const API_KEY = process.env.API_KEY;
fetch(`https://api.example.com/data?key=${API_KEY}`);
```

---

## TypeScript Rules

### MUST_DO (Critical)

| ID   | Rule                | Check                                 |
| ---- | ------------------- | ------------------------------------- |
| T001 | Strict mode enabled | `tsconfig.json` strict: true          |
| T002 | Geen implicit any   | Explicit types                        |
| T003 | Null checks         | Optional chaining, nullish coalescing |

#### Voorbeelden

**T002** Geen implicit any

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

| ID   | Rule                               | Rationale                 |
| ---- | ---------------------------------- | ------------------------- |
| T101 | Discriminated unions voor variants | Type narrowing            |
| T102 | Readonly waar mogelijk             | Immutability              |
| T103 | Generics voor herbruikbare code    | Type safety + flexibility |

### AVOID (Medium)

| ID   | Pattern                  | Alternative                  |
| ---- | ------------------------ | ---------------------------- |
| T201 | Type assertions (`as`)   | Type guards                  |
| T202 | Non-null assertion (`!`) | Optional chaining            |
| T203 | Enums                    | Const objects of union types |

---

## React/Next.js Rules (frontend-specifiek)

### MUST_DO (Critical)

| ID   | Rule                                     | Rationale          | Check                                                             |
| ---- | ---------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| R001 | Gebruik semantic HTML elements           | Accessibility, SEO | `<button>` i.p.v. `<div onClick>`, `<nav>`, `<main>`, `<article>` |
| R002 | Alle images hebben alt text              | Accessibility      | `<img alt="...">` of `alt=""` voor decoratief                     |
| R003 | Geen inline styles voor theming          | Maintainability    | Gebruik CSS variables/tokens, geen `style={{color: '#fff'}}`      |
| R004 | Form inputs hebben labels                | Accessibility      | `<label>` gekoppeld via `htmlFor` of wrapping                     |
| R005 | Interactive elements keyboard accessible | Accessibility      | `tabIndex`, `onKeyDown` waar nodig, native elements preferred     |
| R006 | Error boundaries voor async components   | Reliability        | Wrap async/suspense met ErrorBoundary                             |

#### Voorbeelden

**R001** Semantic HTML

```jsx
// ✗ Incorrect
<div onClick={handleClick} className="button">Click me</div>
<div className="navigation">...</div>

// ✓ Correct
<button onClick={handleClick}>Click me</button>
<nav>...</nav>
```

**R003** Geen inline styles

```jsx
// ✗ Incorrect
<h1 style={{ color: '#fff', fontSize: '24px' }}>Title</h1>

// ✓ Correct
<h1 className="text-foreground text-2xl">Title</h1>
```

**R004** Form labels

```jsx
// ✗ Incorrect
<input type="email" placeholder="Email" />

// ✓ Correct
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

**R005** Keyboard accessible

```jsx
// ✗ Incorrect
<div onClick={handleOpen} className="card">Open details</div>

// ✓ Correct
<button onClick={handleOpen} className="card">Open details</button>
```

**R006** Error boundaries

```jsx
// ✗ Incorrect
<UserProfile userId={id} />

// ✓ Correct
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Skeleton />}>
    <UserProfile userId={id} />
  </Suspense>
</ErrorBoundary>
```

### SHOULD_DO (High)

| ID   | Rule                                  | Rationale       | Alternative                                         |
| ---- | ------------------------------------- | --------------- | --------------------------------------------------- |
| R101 | Prefereer composition over props      | Flexibility     | `children` en slots i.p.v. config objects           |
| R102 | Separate presentational/container     | Testability     | UI components puur, logic in hooks/containers       |
| R103 | Gebruik design tokens voor spacing    | Consistency     | `var(--spacing-4)` i.p.v. `16px`                    |
| R104 | Mobile-first responsive design        | Performance     | `min-width` media queries                           |
| R105 | Named exports voor tree-shaking       | Bundle size     | `export function X` i.p.v. `export default`         |
| R106 | Colocate styles met components        | Maintainability | `Component.module.css` naast `Component.tsx`        |
| R107 | Types/interfaces expliciet exporteren | DX              | `export interface Props` in eigen file of component |
| R108 | Components >100 regels splitsen       | Maintainability | Extract subcomponents of hooks                      |

### AVOID (Medium)

| ID   | Pattern                              | Alternative                     | Reden                        |
| ---- | ------------------------------------ | ------------------------------- | ---------------------------- |
| R201 | CSS-in-JS voor theming               | CSS variables + Tailwind        | Runtime overhead, SSR issues |
| R202 | Over-generic types (`any`, `object`) | Specifieke discriminated unions | Type safety                  |
| R203 | Deep nesting (>3 levels)             | Flatten met composition         | Readability, complexity      |
| R204 | Prop drilling (>2 levels)            | Context of composition          | Maintainability              |
| R205 | Direct DOM manipulation              | React refs of state             | Consistency, bugs            |
| R206 | Index als key in lists               | Stabiele unique IDs             | Re-render bugs               |
| R207 | useEffect voor derived state         | useMemo of compute in render    | Performance, bugs            |
| R208 | Barrel exports in large codebases    | Direct imports                  | Tree-shaking, circular deps  |

---

## HTML/CSS Rules (frontend-specifiek)

### MUST_DO (Critical)

| ID   | Rule                             | Check                     |
| ---- | -------------------------------- | ------------------------- |
| H001 | Valid HTML structure             | DOCTYPE, html, head, body |
| H002 | Eén h1 per pagina                | SEO, accessibility        |
| H003 | Heading hierarchy (h1→h2→h3)     | Geen h3 voor h2           |
| H004 | Color contrast ≥4.5:1 voor tekst | WCAG AA                   |
| H005 | Color contrast ≥3:1 voor UI      | Borders, icons            |
| H006 | Touch targets ≥44x44px           | Mobile accessibility      |

#### Voorbeelden

**H003** Heading hierarchy

```html
<!-- ✗ Incorrect -->
<h1>Page Title</h1>
<h3>Subsection</h3>

<!-- ✓ Correct -->
<h1>Page Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

### SHOULD_DO (High)

| ID   | Rule                              | Rationale            |
| ---- | --------------------------------- | -------------------- |
| H101 | Gebruik CSS custom properties     | Theming, consistency |
| H102 | Logical properties (inline/block) | Internationalization |
| H103 | Prefer flexbox/grid over floats   | Modern, maintainable |
| H104 | Mobile-first breakpoints          | Performance          |

### AVOID (Medium)

| ID   | Pattern                     | Alternative            |
| ---- | --------------------------- | ---------------------- |
| H201 | `!important` in stylesheets | Specificity management |
| H202 | Magic numbers               | Design tokens          |
| H203 | ID selectors voor styling   | Class selectors        |
| H204 | Deep selector nesting (>3)  | BEM of flat selectors  |

---

## Validation Checkpoints

### Pre-Wireframe Validation

Check deze rules in requirements/specifications:

```
WIREFRAME PRE-CHECK
───────────────────
[ ] R001 - Semantic elements gepland
[ ] R004 - Form labels in spec
[ ] R005 - Keyboard nav considered
[ ] H002 - Heading hierarchy defined
[ ] H006 - Touch targets specified
```

### Post-Wireframe Validation

Verify in gegenereerde HTML:

```
WIREFRAME POST-CHECK
────────────────────
[ ] H001 - Valid HTML structure
[ ] H002 - Eén h1 aanwezig
[ ] H003 - Heading hierarchy correct
[ ] R001 - Semantic elements used
[ ] R002 - Alt text waar nodig
[ ] H006 - Touch targets adequate
```

### Pre-Style Validation

Check voordat styling begint:

```
STYLE PRE-CHECK
───────────────
[ ] THEME.md bestaat
[ ] Required tokens aanwezig
[ ] No conflicting styles
```

### Post-Style Validation

Verify in gegenereerde CSS:

```
STYLE POST-CHECK
────────────────
[ ] R003 - Geen inline styles voor theming
[ ] R103 - Design tokens gebruikt
[ ] H001 - Valid CSS syntax
[ ] H101 - CSS variables defined
[ ] H201 - Geen !important
[ ] H202 - Geen magic numbers
```

### Pre-Component Validation

Check voordat components gemaakt worden:

```
COMPONENT PRE-CHECK
───────────────────
[ ] Style tokens beschikbaar
[ ] Types defined
[ ] Props interface clear
```

### Post-Component Validation

Verify in gegenereerde components:

```
COMPONENT POST-CHECK
────────────────────
[ ] R001 - Semantic HTML
[ ] R002 - Alt text
[ ] R004 - Labels
[ ] R005 - Keyboard accessible
[ ] R101 - Composition pattern
[ ] R102 - Presentational puur
[ ] R105 - Named export
[ ] T001 - TypeScript strict
[ ] T002 - No implicit any
```

---

## Severity Mapping

### Voor Validation Reports

```
CRITICAL (blocks merge):
- Alle MUST_DO violations
- Security issues (R008)
- Accessibility blockers (R001, R002, R004, R005, H004, H006)

HIGH (requires review):
- Alle SHOULD_DO violations
- Performance concerns
- Maintainability issues

MEDIUM (advisory):
- Alle AVOID patterns
- Style preferences
- Optimization suggestions
```

### Scoring

```
VALIDATION SCORE
────────────────
Total rules checked: [N]
Passed: [N]
Failed: [N]

By severity:
- CRITICAL: [N] violations (must fix)
- HIGH: [N] violations (should fix)
- MEDIUM: [N] violations (consider fixing)

Score: [X]% compliant
Status: [PASS ≥90% | REVIEW 70-89% | FAIL <70%]
```

---

## Auto-Fix Suggestions

### Safe Auto-Fixes (kan automatisch)

| Rule | Auto-Fix                                |
| ---- | --------------------------------------- |
| R002 | Add `alt=""` to decorative images       |
| R105 | Convert default to named export         |
| H202 | Replace magic number with closest token |
| T203 | Convert enum to const object            |

### Guided Fixes (met user confirmation)

| Rule | Guidance                                    |
| ---- | ------------------------------------------- |
| R001 | Suggest semantic element, show before/after |
| R003 | Extract inline style to CSS variable        |
| R004 | Generate label, ask for text                |
| R101 | Show composition refactor pattern           |

### Manual Fixes (alleen instructions)

| Rule | Instructions                                |
| ---- | ------------------------------------------- |
| R006 | Explain ErrorBoundary pattern               |
| R102 | Explain separation pattern                  |
| H004 | Calculate required contrast, suggest colors |
