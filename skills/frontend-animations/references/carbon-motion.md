# IBM Carbon Motion Reference

Canonical motion values from IBM Carbon Design System. Available as opt-in extras via Customize — not bundled into any default pack.

Provenance: Carbon Design System motion guidelines at carbondesignsystem.com/guidelines/motion — publicly documented by IBM.

Best for: Enterprise data applications, dashboards, B2B SaaS, admin panels. Carbon's defining trait is **separate entrance and exit curves** — a deliberate design choice for data-dense UIs where users need to track state changes clearly.

Cross-links: For Material 3, see `material-motion.md`. For Fluent 2, see `fluent-motion.md`. For Apple iOS, see `ios-easings.md`. For Linear/GitHub/Vercel, see `web-baseline.md`.

---

## The Four Carbon Easing Curves

Carbon separates entrance and exit curves at the easing level, not just directionally (unlike most systems which only use decelerate-in/accelerate-out). This makes state changes more legible in complex UIs.

| Token                    | cubic-bezier                      | Carbon label      | Use                                                                      |
| ------------------------ | --------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `ease-carbon-standard`   | `cubic-bezier(0.2, 0, 0.38, 0.9)` | Standard Easing   | Symmetric transitions: expanding/collapsing in place, tab switch         |
| `ease-carbon-entrance`   | `cubic-bezier(0, 0, 0.38, 0.9)`   | Entrance Easing   | Elements entering viewport: panel open, notification appear, row add     |
| `ease-carbon-exit`       | `cubic-bezier(0.2, 0, 1, 0.9)`    | Exit Easing       | Elements leaving viewport: panel close, notification dismiss, row remove |
| `ease-carbon-expressive` | `cubic-bezier(0.4, 0.14, 0.3, 1)` | Expressive Easing | Emphasis moments: hero entrance, onboarding highlight, data reveal       |

> **The entrance/exit pair rule**: Use `ease-carbon-entrance` when an element comes in, `ease-carbon-exit` when it leaves — even on the same component. Never use `ease-in-out` for both directions; Carbon considers this visually imprecise.

---

## The Six Carbon Duration Tokens

Carbon uses a two-tier system: **fast** durations for productive (utility) interactions and **slow** durations for expressive (emphasis) moments.

| Token                         | Value   | Carbon label | Category   | Typical use                                                 |
| ----------------------------- | ------- | ------------ | ---------- | ----------------------------------------------------------- |
| `duration-carbon-fast-01`     | `70ms`  | Fast 01      | Productive | Micro: focus ring, tooltip trigger, icon swap               |
| `duration-carbon-fast-02`     | `110ms` | Fast 02      | Productive | Small components: checkbox, toggle, tag                     |
| `duration-carbon-moderate-01` | `150ms` | Moderate 01  | Productive | Standard components: button press, dropdown item, accordion |
| `duration-carbon-moderate-02` | `240ms` | Moderate 02  | Productive | Container transitions: inline notification, modal fade      |
| `duration-carbon-slow-01`     | `400ms` | Slow 01      | Expressive | Deliberate reveals: data table row expand, side panel       |
| `duration-carbon-slow-02`     | `700ms` | Slow 02      | Expressive | Hero moments: page enter, large modal, onboarding           |

> **Productive vs Expressive**: Carbon explicitly tags durations by intent. Productive transitions should be imperceptible as motion — users notice the result, not the animation. Expressive transitions earn attention because the content warrants it.

---

## Carbon Data Table Row Reveal

Signature Carbon pattern for enterprise apps. Rows enter with a staggered entrance-easing slide; rows exiting use a faster exit-easing with no stagger.

```css
/* Row enter */
@keyframes carbon-row-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.data-row {
  animation: carbon-row-enter var(--duration-carbon-moderate-01)
    var(--ease-carbon-entrance) both;
  animation-delay: calc(var(--row-index, 0) * 20ms);
}

/* Row exit */
@keyframes carbon-row-exit {
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.data-row[data-removing="true"] {
  animation: carbon-row-exit var(--duration-carbon-fast-02)
    var(--ease-carbon-exit) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .data-row {
    animation: none;
    opacity: 1;
  }
}
```

```tsx
// React — motion.dev data table with row management
function DataTable({ rows }: { rows: Row[] }) {
  return (
    <table>
      <tbody>
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.tr
              key={row.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.15, // duration-carbon-moderate-01
                  ease: [0, 0, 0.38, 0.9], // ease-carbon-entrance
                  delay: i * 0.02,
                },
              }}
              exit={{
                opacity: 0,
                y: -4,
                transition: {
                  duration: 0.11, // duration-carbon-fast-02
                  ease: [0.2, 0, 1, 0.9], // ease-carbon-exit
                },
              }}
            >
              <td>{row.name}</td>
              <td>{row.value}</td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  );
}
```

---

## Carbon Notification Pattern

Inline notifications (toasts) use the standard productive pair: enter with `ease-carbon-entrance`, exit with `ease-carbon-exit`. No stagger — notifications are independent events.

```tsx
function CarbonNotification({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.24, ease: [0, 0, 0.38, 0.9] }, // ease-carbon-entrance
      }}
      exit={{
        opacity: 0,
        y: -8,
        transition: { duration: 0.11, ease: [0.2, 0, 1, 0.9] }, // ease-carbon-exit
      }}
      className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded"
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="ml-auto text-muted hover:text-foreground"
      >
        ✕
      </button>
    </motion.div>
  );
}
```

---

## CSS Variables

Available after Customize injection:

```css
/* IBM Carbon easings */
--ease-carbon-standard: cubic-bezier(0.2, 0, 0.38, 0.9);
--ease-carbon-entrance: cubic-bezier(0, 0, 0.38, 0.9);
--ease-carbon-exit: cubic-bezier(0.2, 0, 1, 0.9);
--ease-carbon-expressive: cubic-bezier(0.4, 0.14, 0.3, 1);

/* IBM Carbon durations */
--duration-carbon-fast-01: 70ms;
--duration-carbon-fast-02: 110ms;
--duration-carbon-moderate-01: 150ms;
--duration-carbon-moderate-02: 240ms;
--duration-carbon-slow-01: 400ms;
--duration-carbon-slow-02: 700ms;
```

---

## When to Use via Customize Route

Carbon motion is injected through `/frontend-animations → Customize → Add easings from other systems`. It does not change the active pack. Typical use cases:

- **Admin panels and dashboards** with live data tables and row CRUD operations
- **B2B SaaS** with heavy form flows and inline validation — the entrance/exit pair is especially legible for form field state changes
- **Internal tooling** where users are experts who notice animation delays: Carbon's fast productive durations keep the UI snappy
- **Mixed stack**: Standard pack (Material 3) for page navigation + Carbon entrance/exit pair for table row animations — they compose cleanly because Carbon's curves don't conflict with M3's emphasis curves
