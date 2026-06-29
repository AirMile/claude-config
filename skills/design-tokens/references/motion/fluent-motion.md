# Microsoft Fluent 2 Motion Reference

Canonical motion values from Microsoft Fluent Design System 2 (Windows 11 era). Available as opt-in extras via Customize — not bundled into any default pack.

Provenance: Fluent 2 motion specification at fluent2.microsoft.design/motion — publicly documented by Microsoft.

Best for: Desktop-class web apps targeting Windows 11 aesthetics, Electron apps, Microsoft 365 add-ins, Teams extensions.

Cross-links: For Material 3, see `material-motion.md`. For Apple iOS, see `ios-easings.md`. For Carbon, see `carbon-motion.md`. For Linear/GitHub/Vercel, see `web-baseline.md`.

---

## The Four Fluent Easing Curves

Fluent 2 defines directional curves: `accelerate` for exits (element leaves screen), `decelerate` for entrances (element enters screen), `max` for high-emphasis moments, and `easyEase` for symmetric in/out transitions.

| Token                    | cubic-bezier                     | Fluent 2 label | Use                                                           |
| ------------------------ | -------------------------------- | -------------- | ------------------------------------------------------------- |
| `ease-fluent-decelerate` | `cubic-bezier(0.1, 0.9, 0.2, 1)` | Decelerate     | Elements entering: panel slide-in, menu reveal, dialog appear |
| `ease-fluent-accelerate` | `cubic-bezier(0.7, 0, 1, 0.5)`   | Accelerate     | Elements exiting: panel close, menu dismiss, dialog hide      |
| `ease-fluent-max`        | `cubic-bezier(0.8, 0, 0.78, 1)`  | Max            | High-emphasis moments: command bar reveal, Fluent Reveal      |
| `ease-fluent-easy-ease`  | `cubic-bezier(0.33, 0, 0.67, 1)` | Easy Ease      | Symmetric transitions: icon swap, tab switch, color change    |

> **Directional pairing rule**: Enter with `ease-fluent-decelerate` and exit with `ease-fluent-accelerate`. This asymmetry — slow-in / fast-out — is a signature Fluent trait and what distinguishes it from generic ease-in-out curves.

---

## The Seven Fluent Duration Tokens

Fluent uses named tiers instead of a numeric scale.

| Token                        | Value   | Fluent label | Typical use                                                   |
| ---------------------------- | ------- | ------------ | ------------------------------------------------------------- |
| `duration-fluent-ultra-fast` | `50ms`  | Ultra Fast   | Micro-interactions: focus ring appear, tooltip pop            |
| `duration-fluent-faster`     | `100ms` | Faster       | Small state changes: checkbox, radio, toggle                  |
| `duration-fluent-fast`       | `150ms` | Fast         | Small component transitions: badge, tag, icon state           |
| `duration-fluent-normal`     | `200ms` | Normal       | Standard transitions: menu open/close, nav item, button press |
| `duration-fluent-slow`       | `300ms` | Slow         | Medium transitions: panel expand, dropdown, sheet             |
| `duration-fluent-slower`     | `400ms` | Slower       | Complex transitions: command bar, large panel, side nav       |
| `duration-fluent-ultra-slow` | `500ms` | Ultra Slow   | Rich transitions: full-page modal, onboarding step            |

---

## Fluent Reveal Pattern

Fluent's signature directional reveal — used for panels, side navigation, command surfaces sliding in from an edge. Distinct from a modal because it doesn't occlude the whole screen; it pushes or overlaps content from one side.

```css
/* Panel / side nav reveal — slides in from left */
.fluent-panel {
  transform: translateX(-100%);
  transition:
    transform var(--duration-fluent-slow) var(--ease-fluent-decelerate),
    opacity var(--duration-fluent-fast) var(--ease-fluent-decelerate);
  opacity: 0;
}
.fluent-panel[data-open="true"] {
  transform: translateX(0);
  opacity: 1;
}
.fluent-panel[data-open="false"] {
  transition:
    transform var(--duration-fluent-faster) var(--ease-fluent-accelerate),
    opacity var(--duration-fluent-faster) var(--ease-fluent-accelerate);
}

@media (prefers-reduced-motion: reduce) {
  .fluent-panel {
    transition: opacity var(--duration-fluent-fast) ease;
    transform: none;
  }
}
```

```tsx
// React — motion.dev
function FluentPanel({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "-100%", opacity: 0 }}
          animate={{
            x: 0,
            opacity: 1,
            transition: {
              x: { duration: 0.3, ease: [0.1, 0.9, 0.2, 1] }, // ease-fluent-decelerate
              opacity: { duration: 0.15, ease: [0.1, 0.9, 0.2, 1] },
            },
          }}
          exit={{
            x: "-100%",
            opacity: 0,
            transition: {
              x: { duration: 0.1, ease: [0.7, 0, 1, 0.5] }, // ease-fluent-accelerate
              opacity: { duration: 0.1, ease: [0.7, 0, 1, 0.5] },
            },
          }}
          className="fixed left-0 top-0 h-full w-72 bg-surface shadow-xl z-40"
        >
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
```

---

## Fluent Occlude Pattern

When a panel or overlay temporarily hides content below it, fade the background with `max` curve to signal the depth change.

```tsx
function FluentOccludeScrim({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-30 bg-black/20"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: 0.2, ease: [0.8, 0, 0.78, 1] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.1, ease: [0.7, 0, 1, 0.5] },
          }}
        />
      )}
    </AnimatePresence>
  );
}
```

---

## CSS Variables

Available after Customize injection or when a Fluent-flavored project opts in:

```css
/* Fluent 2 easings */
--ease-fluent-decelerate: cubic-bezier(0.1, 0.9, 0.2, 1);
--ease-fluent-accelerate: cubic-bezier(0.7, 0, 1, 0.5);
--ease-fluent-max: cubic-bezier(0.8, 0, 0.78, 1);
--ease-fluent-easy-ease: cubic-bezier(0.33, 0, 0.67, 1);

/* Fluent 2 durations */
--duration-fluent-ultra-fast: 50ms;
--duration-fluent-faster: 100ms;
--duration-fluent-fast: 150ms;
--duration-fluent-normal: 200ms;
--duration-fluent-slow: 300ms;
--duration-fluent-slower: 400ms;
--duration-fluent-ultra-slow: 500ms;
```

---

## When to Use via Customize Route

Fluent motion is injected through `/design-tokens → Motion Pack → Customize → Add easings from other systems`. It does not change the active pack. Typical use cases:

- **Electron / Tauri desktop app** targeting Windows 11 UI conventions
- **Microsoft 365 add-in** or Teams extension that shares a host with Fluent components
- **Side navigation panel** on any stack — `ease-fluent-decelerate` for panel open, `ease-fluent-accelerate` for close is universally good UX regardless of target OS
- **Mixed stack**: Standard pack (Material 3) for page transitions + Fluent panel curves for the nav drawer
