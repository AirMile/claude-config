# Choreography Compositions

Named animation compositions available per pack. Each composition is a named preset that `design.components[i].motion.*` can reference.

**Pack availability:** None=❌ Subtle=⬤ Standard=⬤ Expressive=⬤ Playful=⬤

---

## Entrance Compositions

### `entrance.float-in` — Subtle+

Opacity + subtle upward float. Used for cards, modals, list items entering viewport.

```css
@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.entrance-float-in {
  animation: float-in var(--duration-normal) var(--ease-out) both;
}
@media (prefers-reduced-motion: reduce) {
  .entrance-float-in {
    animation: fade-only 150ms ease both;
  }
}
```

```tsx
// React — motion.dev
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 220, damping: 28, mass: 1 }}
/>
```

---

## Exit Compositions

### `exit.fade-out` — Subtle+

Simple opacity fade. Exit duration = 75% of enter.

```css
.exit-fade-out {
  animation: fade-out calc(var(--duration-normal) * 0.75) var(--ease-in) both;
}
@keyframes fade-out {
  to {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .exit-fade-out {
    animation-duration: 0.01ms !important;
  }
}
```

---

## Success Compositions

### `success.pulse` — Standard+

Scale + accent ring flash on success. Opt-in: `design.components[i].motion.onSuccess: "success.pulse"`.

```css
@keyframes success-pulse {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.08);
    box-shadow: 0 0 0 4px
      color-mix(in oklch, var(--color-success) 30%, transparent);
  }
  100% {
    transform: scale(1);
    box-shadow: none;
  }
}
.success-pulse {
  animation: success-pulse 500ms var(--spring-bouncy-bezier) both;
}
@media (prefers-reduced-motion: reduce) {
  .success-pulse {
    animation: none;
  }
}
```

### `success.confetti` — Playful only

Particle burst from element origin. **Always opt-in per component.** Max 30 particles, GPU transform/opacity only, 1.2s, auto-cleanup.

```tsx
// Lightweight vanilla implementation (no library needed)
function triggerConfetti(origin: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = [
    "var(--color-accent-primary)",
    "var(--color-success)",
    "var(--color-warning)",
  ];

  for (let i = 0; i < 30; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999;
      width: 6px; height: 6px; border-radius: 50%;
      background: ${colors[i % colors.length]};
      left: ${cx}px; top: ${cy}px;
      will-change: transform, opacity;
    `;
    document.body.appendChild(el);
    const angle = (i / 30) * Math.PI * 2;
    const dist = 60 + Math.random() * 80;
    el.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`,
          opacity: 0,
        },
      ],
      { duration: 1200, easing: "cubic-bezier(0,0,0.2,1)", fill: "forwards" },
    ).onfinish = () => el.remove();
  }
}
```

---

## Attention Compositions

### `attention.wiggle` — Playful only

Rotation wiggle. Only on user-initiated attention moments — never on every hover.

```css
@keyframes wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-3deg);
  }
  40% {
    transform: rotate(3deg);
  }
  60% {
    transform: rotate(-2deg);
  }
  80% {
    transform: rotate(2deg);
  }
}
.attention-wiggle {
  animation: wiggle 400ms var(--spring-bouncy-bezier);
}
@media (prefers-reduced-motion: reduce) {
  .attention-wiggle {
    animation: none;
  }
}
```

---

## Error Compositions

### `error.shake` — Subtle+

Horizontal shake. Use on form field or submit button on validation failure.

```css
@keyframes error-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(3px);
  }
}
.error-shake {
  animation: error-shake 350ms linear;
}
@media (prefers-reduced-motion: reduce) {
  .error-shake {
    animation: none;
  }
}
```

---

## Press Compositions

### `press.squeeze` — Playful only

Replaces standard `scale(0.98)` with a springy squeeze.

```css
.press-squeeze {
  transition: transform var(--spring-bouncy-duration)
    var(--spring-bouncy-bezier);
}
.press-squeeze:active {
  transform: scale(0.94);
}
/* Spring physics naturally creates the 0.94 → 1.02 → 1 overshoot */
@media (prefers-reduced-motion: reduce) {
  .press-squeeze {
    transition: none;
  }
}
```

---

## Loading Compositions

### `loading.bob` — Expressive+

Gentle vertical bob for loading/waiting states. Cute, non-distracting.

```css
@keyframes loading-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
.loading-bob {
  animation: loading-bob 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .loading-bob {
    animation: none;
  }
}
```

---

## Route Transition Compositions

### `route.fade-slide` — Standard+

Subtle fade + horizontal slide for SPA route changes.

```css
::view-transition-old(root) {
  animation: 200ms var(--ease-in) both route-fade-out;
}
::view-transition-new(root) {
  animation: 300ms var(--ease-out) both route-fade-in;
}
@keyframes route-fade-out {
  to {
    opacity: 0;
    transform: translateX(-12px);
  }
}
@keyframes route-fade-in {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

### `route.ios-push` — Expressive+

Matches iOS navigation push/pop. Uses `ease-ios-spring` for enter, `ease-ios-in` for exit.

```css
::view-transition-old(root) {
  animation: calc(var(--duration-ios-modal) * 0.75) var(--ease-ios-in) both
    route-ios-exit;
}
::view-transition-new(root) {
  animation: var(--duration-ios-modal) var(--ease-ios-spring) both
    route-ios-enter;
}
@keyframes route-ios-exit {
  to {
    opacity: 0;
    transform: translateX(-30px);
  }
}
@keyframes route-ios-enter {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

---

## List Stagger

### `list.stagger-reveal` — Standard+

```css
.stagger-item {
  animation: float-in var(--duration-normal) var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
/* Cap: 10 items max for stagger — beyond that, animate all at once */
@media (prefers-reduced-motion: reduce) {
  .stagger-item {
    animation: none;
    opacity: 1;
  }
}
```

---

## Modal Reveal Compositions

### `modal.slide-up` — Standard+

Generic slide-up for modals and dialogs.

```css
.modal-slide-up {
  animation: slide-up var(--duration-normal) var(--spring-smooth-bezier) both;
}
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### `modal.ios-sheet` — Expressive+

Full iOS bottom sheet with spring-gentle.

```css
.ios-sheet {
  transform: translateY(100%);
  transition: transform var(--spring-gentle-duration)
    var(--spring-gentle-bezier);
}
.ios-sheet[data-open="true"] {
  transform: translateY(0);
}
.ios-sheet[data-open="false"] {
  transition-duration: calc(var(--spring-gentle-duration) * 0.75);
  transition-timing-function: var(--ease-ios-in);
}
@media (prefers-reduced-motion: reduce) {
  .ios-sheet {
    transition: none;
  }
}
```

---

## Count-up Number

### `count-up.number` — Playful only

RAF-driven numeric tween. Suffix-aware (`$`, `%`, `k`).

```tsx
function useCountUp(target: number, duration = 800, suffix = "") {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setValue(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return `${value}${suffix}`;
}
```

---

## Surface Tilt

### `surface.tilt` — Playful only

Pointer-tracking 3D perspective tilt. Disabled on touch devices and `prefers-reduced-motion`.

```tsx
function useTilt(maxDeg = 6) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return; // touch device

    const el = ref.current;
    if (!el) return;

    let rafId: number;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rotX = ((e.clientY - cy) / (rect.height / 2)) * -maxDeg;
        const rotY = ((e.clientX - cx) / (rect.width / 2)) * maxDeg;
        el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      });
    };
    const onLeave = () => {
      el.style.transform = "";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafId);
    };
  }, [maxDeg]);

  return ref;
}
```
