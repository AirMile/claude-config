# Route: Customize (Axis-by-axis)

For users who want to mix aspects of different packs. Requires an existing `motion.pack` — run Create first if none is set.

The current pack's axes are shown as defaults. Each axis can be overridden independently.

---

## Step 1 — Show current state

```
Current pack:  {pack}
Axes:
  expressiveness  {current}   (subtle / standard / expressive / playful)
  springiness     {current}   (linear / smooth / snappy / bouncy)
  tempo           {current}   (slow / normal / fast)
  surfaces        {current}   (flat / elevated / glass)
```

---

## Step 2 — Axis overrides (one question per axis, skip if user says "keep")

### Axis: expressiveness

Controls how rich the choreography set is.

| Value        | Choreography included                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| `subtle`     | entrance.float-in · exit.fade-out · error.shake                                        |
| `standard`   | + success.pulse · route.fade-slide · list.stagger-reveal · modal.slide-up              |
| `expressive` | + route.ios-push · modal.ios-sheet · loading.bob                                       |
| `playful`    | + success.confetti · attention.wiggle · press.squeeze · count-up.number · surface.tilt |

### Axis: springiness

Controls which spring tokens are active and what the hover/press interaction feels like.

| Value    | Springs                       | Hover                     | Press                               |
| -------- | ----------------------------- | ------------------------- | ----------------------------------- |
| `linear` | none                          | translateY(-1px)          | scale(0.98) — instant               |
| `smooth` | spring-smooth                 | translateY(-2px)          | scale(0.97) spring-smooth           |
| `snappy` | spring-smooth + spring-snappy | translateY(-2px) + shadow | scale(0.94) spring-snappy           |
| `bouncy` | all four springs              | translateY(-2px) + shadow | scale(0.94) spring-bouncy (squeeze) |

### Axis: tempo

Multiplier applied to all `motion.durations[]` values.

| Value    | Multiplier | Effect                 |
| -------- | ---------- | ---------------------- |
| `slow`   | 1.25×      | Meditative, deliberate |
| `normal` | 1×         | Default                |
| `fast`   | 0.75×      | Snappy, efficient      |

Stored in `motion.axes.tempo`. Applied at CSS-vars generation time (multiplied into `--duration-*` values in `theme.cssVars`).

### Axis: surfaces

| Value      | Effect                                                |
| ---------- | ----------------------------------------------------- |
| `flat`     | No elevation system, `surfaces.glass.enabled = false` |
| `elevated` | Elevation tokens 1–4 active, no glass                 |
| `glass`    | Elevation tokens + `surfaces.glass.enabled = true`    |

If switching to `glass`, show the glass confirmation from route-create.md Step 3.

---

## Step 3 — Choreography overrides (optional)

After axes, offer to pin individual choreography slots:

> "Want to override any specific choreography composition? (e.g. use success.pulse even though expressiveness=subtle)"
> Yes / No (keep axis defaults)

If Yes: show multi-select of available compositions with their pack requirements. Allow any selection regardless of axis constraints.

---

## Step 4 — Add easings from other systems (optional)

> "Want to add easings from another design system? These are injected into `motion.easings[]` without changing your pack. Available: Material 3 · Fluent 2 · IBM Carbon · skip"

Present multi-select. For each selected source, lazy-load the corresponding reference file and inject the tokens:

| Selection  | Reference file       | Tokens added to `motion.easings[]`                                                                         |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Material 3 | `material-motion.md` | `ease-md-emphasized`, `ease-md-emphasized-decelerate`, `ease-md-emphasized-accelerate`, `ease-md-standard` |
| Fluent 2   | `fluent-motion.md`   | `ease-fluent-decelerate`, `ease-fluent-accelerate`, `ease-fluent-max`, `ease-fluent-easy-ease`             |
| IBM Carbon | `carbon-motion.md`   | `ease-carbon-entrance`, `ease-carbon-exit`, `ease-carbon-standard`, `ease-carbon-expressive`               |

Also inject corresponding CSS vars into `theme.cssVars` (merge, no overwrite of existing).

> **Note**: These easings are available in `shared/TOKENS.md` as canonical names. Use them via `var(--ease-md-emphasized)` etc. after injection.

---

## Step 5 — Preview offer + confirm + write

Same as route-create.md Steps 4–5.

Write:

1. Update `motion.axes` with new values
2. Recompute `motion.spring[]` from springiness axis (merge — only update tokens that changed)
3. Update `motion.choreography{}` from expressiveness axis + any manual overrides
4. Update `surfaces.*` from surfaces axis
5. Inject any additional easings from Step 4 into `motion.easings[]` (merge by token name)
6. Re-emit CSS vars (call route-apply.md)
