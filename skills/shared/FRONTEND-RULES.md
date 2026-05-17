# Frontend Coding Rules

Frontend-specific coding standards. Loaded by dev-verify and dev-refactor for frontend projects.
General and TypeScript rules: see `shared/CODING-RULES.md`.

> **Scope:** React/Next.js, HTML/CSS, Accessibility, Error, Flow, Performance, Responsive, Data Integration.

---

## React/Next.js Rules (frontend-specific)

### MUST_DO (Critical)

| ID   | Rule                                     | Rationale          | Check                                                                 |
| ---- | ---------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| R001 | Use semantic HTML elements               | Accessibility, SEO | `<button>` instead of `<div onClick>`, `<nav>`, `<main>`, `<article>` |
| R002 | All images have alt text                 | Accessibility      | `<img alt="...">` or `alt=""` for decorative                          |
| R003 | No inline styles for theming             | Maintainability    | Use CSS variables/tokens, not `style={{color: '#fff'}}`               |
| R004 | Form inputs have labels                  | Accessibility      | `<label>` linked via `htmlFor` or wrapping                            |
| R005 | Interactive elements keyboard accessible | Accessibility      | `tabIndex`, `onKeyDown` where needed, native elements preferred       |
| R006 | Error boundaries for async components    | Reliability        | Wrap async/suspense with ErrorBoundary                                |

#### Examples

**R001** Semantic HTML

```jsx
// ✗ Incorrect
<div onClick={handleClick} className="button">Click me</div>
<div className="navigation">...</div>

// ✓ Correct
<button onClick={handleClick}>Click me</button>
<nav>...</nav>
```

**R003** No inline styles

```jsx
// ✗ Incorrect
<h1 style={{ color: '#fff', fontSize: '24px' }}>Title</h1>

// ✓ Correct
<h1 className="text-foreground text-2xl">Title</h1>
```

> See `shared/TOKENS.md` for canonical token names, fallback CSS vars, and violation patterns (T101–T105).

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

| ID   | Rule                               | Rationale       | Alternative                                       |
| ---- | ---------------------------------- | --------------- | ------------------------------------------------- |
| R101 | Prefer composition over props      | Flexibility     | `children` and slots instead of config objects    |
| R102 | Separate presentational/container  | Testability     | UI components pure, logic in hooks/containers     |
| R103 | Use design tokens for spacing      | Consistency     | `var(--spacing-4)` instead of `16px`              |
| R104 | Mobile-first responsive design     | Performance     | `min-width` media queries                         |
| R105 | Named exports for tree-shaking     | Bundle size     | `export function X` instead of `export default`   |
| R106 | Colocate styles with components    | Maintainability | `Component.module.css` next to `Component.tsx`    |
| R107 | Explicitly export types/interfaces | DX              | `export interface Props` in own file or component |
| R108 | Split components >100 lines        | Maintainability | Extract subcomponents or hooks                    |

### AVOID (Medium)

| ID   | Pattern                              | Alternative                   | Reason                       |
| ---- | ------------------------------------ | ----------------------------- | ---------------------------- |
| R201 | CSS-in-JS for theming                | CSS variables + Tailwind      | Runtime overhead, SSR issues |
| R202 | Over-generic types (`any`, `object`) | Specific discriminated unions | Type safety                  |
| R203 | Deep nesting (>3 levels)             | Flatten with composition      | Readability, complexity      |
| R204 | Prop drilling (>2 levels)            | Context or composition        | Maintainability              |
| R205 | Direct DOM manipulation              | React refs or state           | Consistency, bugs            |
| R206 | Index as key in lists                | Stable unique IDs             | Re-render bugs               |
| R207 | useEffect for derived state          | useMemo or compute in render  | Performance, bugs            |
| R208 | Barrel exports in large codebases    | Direct imports                | Tree-shaking, circular deps  |

---

## HTML/CSS Rules (frontend-specific)

### MUST_DO (Critical)

| ID   | Rule                               | Check                                   |
| ---- | ---------------------------------- | --------------------------------------- |
| H001 | Valid HTML structure               | DOCTYPE, html, head, body               |
| H002 | One h1 per page                    | SEO, accessibility                      |
| H003 | Heading hierarchy (h1→h2→h3)       | No h3 before h2                         |
| H004 | Color contrast ≥4.5:1 for text     | WCAG AA                                 |
| H005 | Color contrast ≥3:1 for UI         | Borders, icons                          |
| H006 | Touch targets ≥44x44px             | Mobile accessibility                    |
| H007 | No interleaved layout reads/writes | Forced reflow prevention                |
| H008 | No scrollTop-driven animation      | Scroll Timeline or IntersectionObserver |

#### Examples

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

**H007** No interleaved layout reads/writes

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

**H008** No scrollTop-driven animation

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

| ID   | Rule                                               | Rationale               |
| ---- | -------------------------------------------------- | ----------------------- |
| H101 | Use CSS custom properties                          | Theming, consistency    |
| H102 | Logical properties (inline/block)                  | Internationalization    |
| H103 | Prefer flexbox/grid over floats                    | Modern, maintainable    |
| H104 | Mobile-first breakpoints                           | Performance             |
| H105 | Animate only compositor props (transform, opacity) | Performance             |
| H106 | Max 200ms for interaction feedback animations      | Responsiveness          |
| H107 | Respect prefers-reduced-motion                     | Accessibility           |
| H108 | text-balance for headings, text-pretty for body    | Typography              |
| H109 | tabular-nums for data tables                       | Alignment               |
| H110 | h-dvh instead of h-screen                          | Mobile viewport         |
| H111 | Fixed z-index scale (10/20/30/40/50)               | Maintainability         |
| H112 | size-\* for square elements                        | Conciseness             |
| H113 | Loading buttons: disabled + spinner during async   | Prevent double submit   |
| H114 | Confirmation dialog for destructive actions        | Prevent accidental loss |
| H115 | `overscroll-behavior: contain` on modals/drawers   | Scroll leak prevention  |
| H116 | Stagger 50-100ms per item in animated lists/grids  | Smooth visual rhythm    |

### AVOID (Medium)

| ID   | Pattern                                             | Alternative                   |
| ---- | --------------------------------------------------- | ----------------------------- |
| H201 | `!important` in stylesheets                         | Specificity management        |
| H202 | Magic numbers                                       | Design tokens                 |
| H203 | ID selectors for styling                            | Class selectors               |
| H204 | Deep selector nesting (>3)                          | BEM or flat selectors         |
| H205 | Large `blur()`/`backdrop-filter` on visible content | Small blur, brief, one-time   |
| H206 | `will-change` outside active animation blocks       | Add/remove temporarily via JS |
| H207 | Changing `letter-spacing` without explicit request  | Design discipline             |
| H208 | Animating layout properties on large surfaces       | Use `transform`               |
| H209 | Gradients/glow without explicit request             | Tailwind default shadows      |

---

## Accessibility Rules (frontend-specific)

> **Note:** Complements existing a11y-related rules: R001 (semantic HTML), R002 (alt text),
> R004 (form labels), R005 (keyboard accessible), H004 (text contrast), H005 (UI contrast), H006 (touch targets).

### MUST_DO (Critical)

| ID   | Rule                                         | Check                                          |
| ---- | -------------------------------------------- | ---------------------------------------------- |
| A001 | Accessible name for all interactive controls | aria-label, aria-labelledby, or visible text   |
| A002 | No div/span as button without full support   | role + tabIndex + onKeyDown required           |
| A003 | Modals trap focus                            | Focus must not escape open dialog              |
| A004 | Focus restore after dialog close             | Focus back to trigger element                  |
| A005 | Visible focus indicator                      | No outline: none without focus-visible         |
| A006 | ARIA state synchronization                   | aria-expanded/selected matches component state |

#### Examples

**A001** Accessible name

```jsx
// ✗ Incorrect
<button><IconTrash /></button>

// ✓ Correct
<button aria-label="Delete item"><IconTrash /></button>
```

**A002** No div-as-button

```jsx
// ✗ Incorrect
<div onClick={handleClick} className="card">Open</div>

// ✓ Correct (native element preferred)
<button onClick={handleClick} className="card">Open</button>

// ✓ Acceptable (when native element is not possible)
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

**A006** ARIA state synchronization

```jsx
// ✗ Incorrect - aria-expanded not in sync
<button onClick={() => setOpen(!open)}>Menu</button>
<nav className={open ? 'visible' : 'hidden'}>...</nav>

// ✓ Correct
<button aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
<nav className={open ? 'visible' : 'hidden'}>...</nav>
```

### SHOULD_DO (High)

| ID   | Rule                                       | Rationale                      |
| ---- | ------------------------------------------ | ------------------------------ |
| A101 | Error messages linked via aria-describedby | Screen readers announce error  |
| A102 | Required fields with aria-required         | Announced on focus             |
| A103 | aria-live for dynamic error messages       | Changes are read aloud         |
| A104 | Loading states with aria-busy              | Prevents premature interaction |

#### Examples

**A101** Error message linking

```jsx
// ✗ Incorrect
<input id="email" />
<span className="text-error">Invalid email</span>

// ✓ Correct
<input id="email" aria-describedby="email-error" aria-invalid={!!error} />
<span id="email-error" className="text-error">Invalid email</span>
```

**A103** Live region for errors

```jsx
// ✗ Incorrect - screen reader misses dynamic error
{
  error && <div className="error">{error}</div>;
}

// ✓ Correct
<div aria-live="assertive" role="alert">
  {error && <span>{error}</span>}
</div>;
```

### SHOULD_DO (High) — continued

| ID   | Rule                                       | Check                                                                        |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| A007 | Logical tab order throughout the page      | `playwright-cli press Tab` loop → order follows DOM / visual flow            |
| A008 | All interactive elements reachable via Tab | No `tabindex=-1` on reachable buttons/links without programmatic focus mgmt  |
| A009 | No keyboard focus trap outside modals      | `playwright-cli press Tab` loop → focus ends on body or cycling, not hanging |

### AVOID (Medium)

| ID   | Pattern                                    | Alternative                    |
| ---- | ------------------------------------------ | ------------------------------ |
| A201 | tabindex > 0                               | Use DOM order for tab order    |
| A202 | aria-label on non-interactive elements     | Visible text or sr-only span   |
| A203 | Removing focus outline without replacement | focus-visible with custom ring |

---

## Error State Rules (E-series)

> **Scope:** Validation of how the app responds to error scenarios — 404, offline, slow connection. Tested via `/frontend-check` scope "Error states".

### MUST_DO (Critical)

| ID   | Rule                    | Check                                                                             |
| ---- | ----------------------- | --------------------------------------------------------------------------------- |
| E001 | Custom 404 page present | `playwright-cli goto /non-existing-route` → app-404 renders (not browser-default) |
| E002 | Offline UI present      | `page.context().setOffline(true)` → custom offline state renders                  |

### SHOULD_DO (High)

| ID   | Rule                                 | Rationale                             |
| ---- | ------------------------------------ | ------------------------------------- |
| E101 | Loading skeleton on slow connection  | `route()` throttle → skeleton visible |
| E102 | Error page with navigation back to / | User can always navigate back         |

---

## Flow Rules (F-series)

> **Scope:** Validation of navigation journeys defined in `design.flows[]`. Tested via `/frontend-check` scope "Flow".

### MUST_DO (Critical)

| ID   | Rule                                            | Check                                                                     |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| F001 | Flow navigates without errors through all steps | Each step in `design.flows[].steps` loads without 404/runtime error/crash |

### SHOULD_DO (High)

| ID   | Rule                                     | Check                                                         |
| ---- | ---------------------------------------- | ------------------------------------------------------------- |
| F002 | All flow-pages mapped in context.routing | Each page-name in `steps[]` has a corresponding route in JSON |

---

## Performance Rules (frontend-specific)

### MUST_DO (Critical)

| ID   | Rule                           | Check                                                                    |
| ---- | ------------------------------ | ------------------------------------------------------------------------ |
| P001 | Lighthouse score >= 90 per cat | `npx lighthouse` output all categories ≥ 90                              |
| P002 | No render-blocking resources   | No sync `<script>` or `<link>` in `<head>` that block FCP                |
| P003 | Images optimized               | WebP/AVIF, width/height attributes, lazy loading                         |
| P004 | No JS runtime errors on load   | `playwright-cli console error` → no uncaught exceptions or import errors |
| P005 | No failed critical requests    | `playwright-cli requests` → no 4xx/5xx on same-origin/API endpoints      |

#### Examples

**P002** No render-blocking resources

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

**P003** Images optimized

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

| ID   | Rule                                  | Rationale                                          |
| ---- | ------------------------------------- | -------------------------------------------------- |
| P101 | CLS < 0.1                             | Visual stability                                   |
| P102 | LCP < 2.5s                            | Perceived load speed                               |
| P103 | INP < 200ms                           | Input responsiveness                               |
| P104 | Bundle < 200KB/route (gzipped)        | Load performance                                   |
| P105 | Code splitting per route              | Only load what is needed                           |
| P106 | Font loading strategy (swap/optional) | No FOIT                                            |
| P107 | Third-party scripts async/defer       | No main thread block                               |
| P108 | Payloads < 500KB per resource         | `playwright-cli requests` → compression/splitting  |
| P109 | Static assets with cache headers      | `response-headers <i>` → `cache-control` or `etag` |

### AVOID (Medium)

| ID   | Pattern                            | Alternative                            |
| ---- | ---------------------------------- | -------------------------------------- |
| P201 | Full library imports               | Tree-shaking, named imports            |
| P202 | Synchronous data loading in render | Suspense, React Query, SWR             |
| P203 | Uncompressed images                | WebP/AVIF with build-time optimization |

---

## Responsive Rules (H-series extension)

> **Note:** Extension of existing H-series in HTML/CSS Rules section.

### SHOULD_DO (High)

| ID   | Rule                                   | Rationale             |
| ---- | -------------------------------------- | --------------------- |
| H117 | No horizontal scroll at 320px viewport | Minimum viewport      |
| H118 | Touch targets reachable in thumb-zone  | Mobile ergonomics     |
| H119 | Viewport meta tag present              | Responsive rendering  |
| H120 | No fixed-width containers that break   | Fluid layout          |
| H121 | Body font >= 16px on mobile            | Readable without zoom |

#### Examples

**H117** No horizontal scroll at 320px

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
<!-- ✗ Incorrect — missing -->
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

## Data Integration Rules (R-series extension)

> **Note:** Extension of existing R-series in React/Next.js Rules section.

### MUST_DO (Critical)

| ID   | Rule                         | Check                                         |
| ---- | ---------------------------- | --------------------------------------------- |
| R109 | Loading state for async data | Skeleton/Spinner visible during loading       |
| R110 | Error state for async data   | Error UI on API failure, not empty page       |
| R111 | Type-safe API responses      | Zod schema or TypeScript interface validation |

#### Examples

**R109** Loading state

```jsx
// ✗ Incorrect — no loading feedback
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

| ID   | Rule                            | Rationale               |
| ---- | ------------------------------- | ----------------------- |
| R112 | No hardcoded API URLs           | Use env variables       |
| R113 | Stale data strategy             | staleTime, revalidation |
| R114 | Optimistic updates where useful | Perceived performance   |

---

## Validation Checkpoints

### Pre-Wireframe Validation

Check these rules in requirements/specifications:

```
WIREFRAME PRE-CHECK
───────────────────
[ ] R001 - Semantic elements planned
[ ] R004 - Form labels in spec
[ ] R005 - Keyboard nav considered
[ ] H002 - Heading hierarchy defined
[ ] H006 - Touch targets specified
```

### Post-Wireframe Validation

Verify in generated HTML:

```
WIREFRAME POST-CHECK
────────────────────
[ ] H001 - Valid HTML structure
[ ] H002 - One h1 present
[ ] H003 - Heading hierarchy correct
[ ] R001 - Semantic elements used
[ ] R002 - Alt text where needed
[ ] H006 - Touch targets adequate
```

### Pre-Style Validation

Check before styling begins:

```
STYLE PRE-CHECK
───────────────
[ ] project.json#theme populated
[ ] Required tokens present
[ ] No conflicting styles
```

### Post-Style Validation

Verify in generated CSS:

```
STYLE POST-CHECK
────────────────
[ ] R003 - No inline styles for theming
[ ] R103 - Design tokens used
[ ] H001 - Valid CSS syntax
[ ] H101 - CSS variables defined
[ ] H201 - No !important
[ ] H202 - No magic numbers
```

### Pre-Component Validation

Check before components are created:

```
COMPONENT PRE-CHECK
───────────────────
[ ] Style tokens available
[ ] Types defined
[ ] Props interface clear
```

### Post-Component Validation

Verify in generated components:

```
COMPONENT POST-CHECK
────────────────────
[ ] R001 - Semantic HTML
[ ] R002 - Alt text
[ ] R004 - Labels
[ ] R005 - Keyboard accessible
[ ] R101 - Composition pattern
[ ] R102 - Presentational pure
[ ] R105 - Named export
[ ] T001 - TypeScript strict
[ ] T002 - No implicit any
```

### Accessibility Validation

Check during accessibility audits and after component generation:

```
A11Y CHECK
──────────
[ ] A001 - All interactive controls have accessible name
[ ] A002 - No div/span-as-button without full keyboard support
[ ] A003 - Modals/dialogs trap focus
[ ] A005 - Focus indicators visible
[ ] A006 - ARIA states synchronized
[ ] A007 - Tab order logical (full keyboard test — /frontend-check --scope=a11y)
[ ] A008 - All interactive elements reachable via Tab
[ ] A009 - No keyboard focus trap outside modals
[ ] R001 - Semantic elements used
[ ] R004 - Form labels present
[ ] H004 - Text contrast sufficient
[ ] H006 - Touch targets adequate
```

### Responsive Validation

Check during responsive audits:

```
RESPONSIVE CHECK
────────────────
[ ] H117 - No horizontal scroll at 320px
[ ] H118 - Touch targets in thumb-zone
[ ] H119 - Viewport meta tag present
[ ] H120 - No fixed-width that breaks
[ ] H121 - Body font >= 16px mobile
[ ] H104 - Mobile-first breakpoints
[ ] H006 - Touch targets ≥ 44x44px
```

### Performance Validation

Check during performance audits:

```
PERFORMANCE CHECK
─────────────────
[ ] P001 - Lighthouse >= 90 per category
[ ] P002 - No render-blocking resources
[ ] P003 - Images optimized
[ ] P101 - CLS < 0.1
[ ] P102 - LCP < 2.5s
[ ] P103 - INP < 200ms
[ ] P104 - Bundle < 200KB/route
```

### Data Integration Validation

Check during data hookup:

```
DATA CHECK
──────────
[ ] R109 - Loading states present
[ ] R110 - Error states present
[ ] R111 - Type-safe API responses
[ ] R112 - No hardcoded API URLs
[ ] R007 - Async error handling
```

---

## Severity Mapping

### For Validation Reports

```
CRITICAL (blocks merge):
- All MUST_DO violations
- Security issues (R008)
- Accessibility blockers (R001, R002, R004, R005, H004, H006, A001-A006, A009)

HIGH (requires review):
- All SHOULD_DO violations
- Performance concerns
- Maintainability issues

MEDIUM (advisory):
- All AVOID patterns
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

### Safe Auto-Fixes (can be applied automatically)

| Rule | Auto-Fix                                         |
| ---- | ------------------------------------------------ |
| R002 | Add `alt=""` to decorative images                |
| R105 | Convert default to named export                  |
| H202 | Replace magic number with closest token          |
| T203 | Convert enum to const object                     |
| A001 | Add `aria-label` to icon-only buttons            |
| A201 | Replace `tabindex="N"` (N>0) with `tabindex="0"` |

### Guided Fixes (with user confirmation)

| Rule | Guidance                                                 |
| ---- | -------------------------------------------------------- |
| R001 | Suggest semantic element, show before/after              |
| R003 | Extract inline style to CSS variable                     |
| R004 | Generate label, ask for text                             |
| R101 | Show composition refactor pattern                        |
| A002 | Replace div-as-button with `<button>`, show before/after |
| A003 | Wrap dialog content in focus trap, show pattern          |
| A101 | Link error messages via aria-describedby                 |

### Manual Fixes (instructions only)

| Rule | Instructions                                |
| ---- | ------------------------------------------- |
| R006 | Explain ErrorBoundary pattern               |
| R102 | Explain separation pattern                  |
| H004 | Calculate required contrast, suggest colors |
| A004 | Explain focus restoration pattern           |
| A006 | Explain ARIA state sync pattern             |
