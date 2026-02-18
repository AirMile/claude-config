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

| ID   | Rule                                 | Check                                   |
| ---- | ------------------------------------ | --------------------------------------- |
| H001 | Valid HTML structure                 | DOCTYPE, html, head, body               |
| H002 | Eén h1 per pagina                    | SEO, accessibility                      |
| H003 | Heading hierarchy (h1→h2→h3)         | Geen h3 voor h2                         |
| H004 | Color contrast ≥4.5:1 voor tekst     | WCAG AA                                 |
| H005 | Color contrast ≥3:1 voor UI          | Borders, icons                          |
| H006 | Touch targets ≥44x44px               | Mobile accessibility                    |
| H007 | Geen interleaved layout reads/writes | Forced reflow prevention                |
| H008 | Geen scrollTop-driven animation      | Scroll Timeline of IntersectionObserver |

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

**H007** Geen interleaved layout reads/writes

```js
// ✗ Incorrect - forces reflow per iteration
elements.forEach((el) => {
  const height = el.offsetHeight; // read
  el.style.height = height * 2 + "px"; // write → reflow
});

// ✓ Correct - batch reads, then batch writes
const heights = elements.map((el) => el.offsetHeight);
elements.forEach((el, i) => {
  el.style.height = heights[i] * 2 + "px";
});
```

**H008** Geen scrollTop-driven animation

```css
/* ✗ Incorrect (JS) */
/* window.addEventListener('scroll', () => {
     el.style.transform = `translateY(${window.scrollY * 0.5}px)`;
   }); */

/* ✓ Correct - CSS Scroll Timeline */
@keyframes parallax {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-100px);
  }
}
.parallax {
  animation: parallax linear;
  animation-timeline: scroll();
}
```

### SHOULD_DO (High)

| ID   | Rule                                                 | Rationale               |
| ---- | ---------------------------------------------------- | ----------------------- |
| H101 | Gebruik CSS custom properties                        | Theming, consistency    |
| H102 | Logical properties (inline/block)                    | Internationalization    |
| H103 | Prefer flexbox/grid over floats                      | Modern, maintainable    |
| H104 | Mobile-first breakpoints                             | Performance             |
| H105 | Animate alleen compositor props (transform, opacity) | Performance             |
| H106 | Max 200ms voor interaction feedback animaties        | Responsiveness          |
| H107 | Respecteer prefers-reduced-motion                    | Accessibility           |
| H108 | text-balance voor headings, text-pretty voor body    | Typography              |
| H109 | tabular-nums voor data tables                        | Alignment               |
| H110 | h-dvh i.p.v. h-screen                                | Mobile viewport         |
| H111 | Vast z-index scale (10/20/30/40/50)                  | Maintainability         |
| H112 | size-\* voor vierkante elementen                     | Conciseness             |
| H113 | Loading buttons: disabled + spinner tijdens async    | Prevent double submit   |
| H114 | Confirmation dialog voor destructieve acties         | Prevent accidental loss |
| H115 | `overscroll-behavior: contain` op modals/drawers     | Scroll leak prevention  |
| H116 | Stagger 50-100ms per item bij animated lists/grids   | Smooth visual rhythm    |

### AVOID (Medium)

| ID   | Pattern                                               | Alternative                            |
| ---- | ----------------------------------------------------- | -------------------------------------- |
| H201 | `!important` in stylesheets                           | Specificity management                 |
| H202 | Magic numbers                                         | Design tokens                          |
| H203 | ID selectors voor styling                             | Class selectors                        |
| H204 | Deep selector nesting (>3)                            | BEM of flat selectors                  |
| H205 | Grote `blur()`/`backdrop-filter` op zichtbare content | Kleine blur, kort, eenmalig            |
| H206 | `will-change` buiten actieve animatie blokken         | Tijdelijk via JS toevoegen/verwijderen |
| H207 | `letter-spacing` wijzigen zonder expliciete vraag     | Design discipline                      |
| H208 | Layout properties animeren op grote surfaces          | `transform` gebruiken                  |
| H209 | Gradients/glow zonder expliciete vraag                | Tailwind default shadows               |

---

## Accessibility Rules (frontend-specifiek)

> **Note:** Complementeert bestaande a11y-gerelateerde rules: R001 (semantic HTML), R002 (alt text),
> R004 (form labels), R005 (keyboard accessible), H004 (tekst contrast), H005 (UI contrast), H006 (touch targets).

### MUST_DO (Critical)

| ID   | Rule                                           | Check                                         |
| ---- | ---------------------------------------------- | --------------------------------------------- |
| A001 | Accessible name voor alle interactive controls | aria-label, aria-labelledby, of visible text  |
| A002 | Geen div/span als button zonder full support   | role + tabIndex + onKeyDown vereist           |
| A003 | Modals trappen focus                           | Focus mag niet buiten open dialog             |
| A004 | Focus restore na dialog close                  | Focus terug naar trigger element              |
| A005 | Zichtbare focus indicator                      | Geen outline: none zonder focus-visible       |
| A006 | ARIA state synchronisatie                      | aria-expanded/selected matcht component state |

#### Voorbeelden

**A001** Accessible name

```jsx
// ✗ Incorrect
<button><IconTrash /></button>

// ✓ Correct
<button aria-label="Verwijder item"><IconTrash /></button>
```

**A002** Geen div-as-button

```jsx
// ✗ Incorrect
<div onClick={handleClick} className="card">Open</div>

// ✓ Correct (native element preferred)
<button onClick={handleClick} className="card">Open</button>

// ✓ Acceptable (als native element niet mogelijk is)
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  }}
>
  Open
</div>
```

**A003** Focus trapping in modal

```jsx
// ✗ Incorrect - focus escapes dialog
<div className="modal">{children}</div>

// ✓ Correct - native dialog traps focus
<dialog ref={dialogRef} onClose={onClose}>
  {children}
</dialog>
```

**A006** ARIA state synchronisatie

```jsx
// ✗ Incorrect - aria-expanded niet in sync
<button onClick={() => setOpen(!open)}>Menu</button>
<nav className={open ? 'visible' : 'hidden'}>...</nav>

// ✓ Correct
<button aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
<nav className={open ? 'visible' : 'hidden'}>...</nav>
```

### SHOULD_DO (High)

| ID   | Rule                                       | Rationale                       |
| ---- | ------------------------------------------ | ------------------------------- |
| A101 | Error messages linked via aria-describedby | Screen readers announcen error  |
| A102 | Required fields met aria-required          | Aangekondigd bij focus          |
| A103 | aria-live voor dynamische error messages   | Wijzigingen worden voorgelezen  |
| A104 | Loading states met aria-busy               | Voorkomt voortijdige interactie |

#### Voorbeelden

**A101** Error message linking

```jsx
// ✗ Incorrect
<input id="email" />
<span className="text-error">Ongeldig email</span>

// ✓ Correct
<input id="email" aria-describedby="email-error" aria-invalid={!!error} />
<span id="email-error" className="text-error">Ongeldig email</span>
```

**A103** Live region voor errors

```jsx
// ✗ Incorrect - screen reader mist dynamische error
{
  error && <div className="error">{error}</div>;
}

// ✓ Correct
<div aria-live="assertive" role="alert">
  {error && <span>{error}</span>}
</div>;
```

### AVOID (Medium)

| ID   | Pattern                                     | Alternative                         |
| ---- | ------------------------------------------- | ----------------------------------- |
| A201 | tabindex > 0                                | Gebruik DOM volgorde voor tab order |
| A202 | aria-label op niet-interactive elementen    | Visuele tekst of sr-only span       |
| A203 | Focus outline verwijderen zonder vervanging | focus-visible met custom ring       |

---

## Performance Rules (frontend-specifiek)

### MUST_DO (Critical)

| ID   | Rule                           | Check                                                          |
| ---- | ------------------------------ | -------------------------------------------------------------- |
| P001 | Lighthouse score >= 90 per cat | `npx lighthouse` output alle categorieën ≥ 90                  |
| P002 | Geen render-blocking resources | Geen sync `<script>` of `<link>` in `<head>` die FCP blokkeren |
| P003 | Images geoptimaliseerd         | WebP/AVIF, width/height attributen, lazy loading               |

#### Voorbeelden

**P002** Geen render-blocking resources

```html
<!-- ✗ Incorrect -->
<head>
  <script src="/analytics.js"></script>
  <link rel="stylesheet" href="/heavy-lib.css" />
</head>

<!-- ✓ Correct -->
<head>
  <script src="/analytics.js" defer></script>
  <link
    rel="preload"
    href="/heavy-lib.css"
    as="style"
    onload="this.rel='stylesheet'"
  />
</head>
```

**P003** Images geoptimaliseerd

```jsx
// ✗ Incorrect
<img src="/hero.png" />

// ✓ Correct
<Image
  src="/hero.webp"
  width={1200}
  height={630}
  alt="Hero banner"
  loading="lazy"
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

### SHOULD_DO (High)

| ID   | Rule                                  | Rationale              |
| ---- | ------------------------------------- | ---------------------- |
| P101 | CLS < 0.1                             | Visual stability       |
| P102 | LCP < 2.5s                            | Perceived load speed   |
| P103 | INP < 200ms                           | Input responsiveness   |
| P104 | Bundle < 200KB/route (gzipped)        | Load performance       |
| P105 | Code splitting per route              | Alleen laden wat nodig |
| P106 | Font loading strategy (swap/optional) | Geen FOIT              |
| P107 | Third-party scripts async/defer       | Geen main thread block |

### AVOID (Medium)

| ID   | Pattern                          | Alternative                            |
| ---- | -------------------------------- | -------------------------------------- |
| P201 | Full library imports             | Tree-shaking, named imports            |
| P202 | Synchrone data loading in render | Suspense, React Query, SWR             |
| P203 | Ongecomprimeerde images          | WebP/AVIF met build-time optimalisatie |

---

## Responsive Rules (H-series uitbreiding)

> **Note:** Uitbreiding op bestaande H-series in HTML/CSS Rules sectie.

### SHOULD_DO (High)

| ID   | Rule                                       | Rationale            |
| ---- | ------------------------------------------ | -------------------- |
| H117 | Geen horizontaal scroll bij 320px viewport | Minimale viewport    |
| H118 | Touch targets in thumb-zone bereikbaar     | Mobile ergonomics    |
| H119 | Viewport meta tag aanwezig                 | Responsive rendering |
| H120 | Geen fixed-width containers die breken     | Fluid layout         |
| H121 | Body font >= 16px op mobiel                | Leesbaar zonder zoom |

#### Voorbeelden

**H117** Geen horizontaal scroll bij 320px

```css
/* ✗ Incorrect */
.container {
  width: 1200px;
}

/* ✓ Correct */
.container {
  width: 100%;
  max-width: 1200px;
}
```

**H119** Viewport meta tag

```html
<!-- ✗ Incorrect — ontbreekt -->
<head>
  <title>App</title>
</head>

<!-- ✓ Correct -->
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>App</title>
</head>
```

---

## Data Integration Rules (R-series uitbreiding)

> **Note:** Uitbreiding op bestaande R-series in React/Next.js Rules sectie.

### MUST_DO (Critical)

| ID   | Rule                          | Check                                        |
| ---- | ----------------------------- | -------------------------------------------- |
| R109 | Loading state voor async data | Skeleton/Spinner zichtbaar tijdens laden     |
| R110 | Error state voor async data   | Error UI bij API failure, niet lege pagina   |
| R111 | Type-safe API responses       | Zod schema of TypeScript interface validatie |

#### Voorbeelden

**R109** Loading state

```jsx
// ✗ Incorrect — geen loading feedback
function UserList() {
  const { data } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  return (
    <ul>
      {data?.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}

// ✓ Correct
function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  if (isLoading) return <UserListSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  return (
    <ul>
      {data.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

**R111** Type-safe API responses

```ts
// ✗ Incorrect — unvalidated response
const data = await res.json();

// ✓ Correct — validated with schema
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const data = UserSchema.parse(await res.json());
```

### SHOULD_DO (High)

| ID   | Rule                           | Rationale               |
| ---- | ------------------------------ | ----------------------- |
| R112 | Geen hardcoded API URLs        | Env variables gebruiken |
| R113 | Stale data strategy            | staleTime, revalidation |
| R114 | Optimistic updates waar nuttig | Perceived performance   |

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

### Accessibility Validation

Check bij accessibility audits en na component generatie:

```
A11Y CHECK
──────────
[ ] A001 - Alle interactive controls hebben accessible name
[ ] A002 - Geen div/span-as-button zonder full keyboard support
[ ] A003 - Modals/dialogs trappen focus
[ ] A005 - Focus indicators zichtbaar
[ ] A006 - ARIA states gesynchroniseerd
[ ] R001 - Semantic elements gebruikt
[ ] R004 - Form labels aanwezig
[ ] H004 - Tekst contrast voldoende
[ ] H006 - Touch targets adequate
```

### Responsive Validation

Check bij responsive audits:

```
RESPONSIVE CHECK
────────────────
[ ] H117 - Geen horizontaal scroll bij 320px
[ ] H118 - Touch targets in thumb-zone
[ ] H119 - Viewport meta tag aanwezig
[ ] H120 - Geen fixed-width die breekt
[ ] H121 - Body font >= 16px mobiel
[ ] H104 - Mobile-first breakpoints
[ ] H006 - Touch targets ≥ 44x44px
```

### Performance Validation

Check bij performance audits:

```
PERFORMANCE CHECK
─────────────────
[ ] P001 - Lighthouse >= 90 per categorie
[ ] P002 - Geen render-blocking resources
[ ] P003 - Images geoptimaliseerd
[ ] P101 - CLS < 0.1
[ ] P102 - LCP < 2.5s
[ ] P103 - INP < 200ms
[ ] P104 - Bundle < 200KB/route
```

### Data Integration Validation

Check bij data hookup:

```
DATA CHECK
──────────
[ ] R109 - Loading states aanwezig
[ ] R110 - Error states aanwezig
[ ] R111 - Type-safe API responses
[ ] R112 - Geen hardcoded API URLs
[ ] R007 - Async error handling
```

---

## Severity Mapping

### Voor Validation Reports

```
CRITICAL (blocks merge):
- Alle MUST_DO violations
- Security issues (R008)
- Accessibility blockers (R001, R002, R004, R005, H004, H006, A001-A006)

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

| Rule | Auto-Fix                                         |
| ---- | ------------------------------------------------ |
| R002 | Add `alt=""` to decorative images                |
| R105 | Convert default to named export                  |
| H202 | Replace magic number with closest token          |
| T203 | Convert enum to const object                     |
| A001 | Add `aria-label` to icon-only buttons            |
| A201 | Replace `tabindex="N"` (N>0) with `tabindex="0"` |

### Guided Fixes (met user confirmation)

| Rule | Guidance                                                 |
| ---- | -------------------------------------------------------- |
| R001 | Suggest semantic element, show before/after              |
| R003 | Extract inline style to CSS variable                     |
| R004 | Generate label, ask for text                             |
| R101 | Show composition refactor pattern                        |
| A002 | Replace div-as-button with `<button>`, show before/after |
| A003 | Wrap dialog content in focus trap, show pattern          |
| A101 | Link error messages via aria-describedby                 |

### Manual Fixes (alleen instructions)

| Rule | Instructions                                |
| ---- | ------------------------------------------- |
| R006 | Explain ErrorBoundary pattern               |
| R102 | Explain separation pattern                  |
| H004 | Calculate required contrast, suggest colors |
| A004 | Explain focus restoration pattern           |
| A006 | Explain ARIA state sync pattern             |
