# Route: Create / Pick Pack

Guided flow for selecting and applying an animation pack to a project.

---

## Step 1 — Detect framework

Read `package.json` (if present) and store:

```
$STACK_TYPE     = "react" | "vue" | "svelte" | "solid" | "vanilla"
$HAS_MOTION_LIB = true | false
$MOTION_LIB     = "motion.dev" | "framer-motion" | "motion-v" | "svelte/motion" | "none"
$CURRENT_PACK   = theme.motion.pack (may be empty string)
```

If `package.json` absent: assume vanilla.

---

## Step 2 — Pack selection

Present a single-select:

```
Which animation pack do you want?

○ None           — No transitions beyond color changes
○ Subtle         — Hover-lift, press-scale, smooth fades
● Standard       — + stagger reveals, modal slides, route fades (Recommended for new projects)
○ Expressive     — iOS/Apple easings, spring physics, glass surfaces
○ Playful        — + bouncy springs, success celebrations, wiggle, tilt

Note: Glass surfaces (Expressive/Playful) can be disabled after selection without changing the pack.
```

Store selection as `$CHOSEN_PACK`.

---

## Step 3 — Glass opt-in confirmation (Expressive/Playful only)

If `$CHOSEN_PACK` is `expressive` or `playful`:

> "This pack enables glass/vibrancy surfaces (`surfaces.glass.enabled = true`). Glass is applied to overlays and navigation bars — not body backgrounds. You can disable it at any time without changing the pack.
>
> Keep glass enabled? Yes (Recommended) / No"

If No: set `surfaces.glass.enabled = false` in the pack delta before writing.

---

## Step 4 — Preview offer

> "Want a preview HTML file before I apply? It shows each token animated in a swatch gallery.
> Yes, generate preview / No, apply now"

If Yes: generate `.project/animation-preview.html` from `preview-template.html` (populate with pack delta tokens), show the path, then continue.

---

## Step 5 — Confirm + write

Display the pack delta summary:

```
Pack:        {chosen_pack}
Springs:     {n} tokens
iOS easings: {n} (Expressive/Playful only)
Glass:       {enabled/disabled}
Stack:       {stack_type} — {motion_lib or "CSS only"}

Ready to apply?  Yes / No
```

On Yes:

1. Read `packs.md` — load the delta for `$CHOSEN_PACK`
2. Delta-write to `project.json#theme` (only owned keys — see SKILL.md § Read/Write Protocol)
3. Add iOS easings to `motion.easings[]` if Expressive/Playful (merge, no dedup by token name)
4. Add iOS durations to `motion.durations[]` if Expressive/Playful (merge)
5. Call Apply route logic to emit CSS vars (see route-apply.md)
6. Run post-flight report

---

## Step 6 — Motion library install offer (if HAS_MOTION_LIB = false and pack is Standard+)

If `$HAS_MOTION_LIB = false` and `$STACK_TYPE` is `react` or `vue` or `svelte`:

> "Your chosen pack benefits from a motion library for spring physics. Want me to add the install command?
>
> React: `npm install motion`
> Vue: `npm install motion-v`
> Svelte: built-in (no install needed)
>
> Show install command / Skip (use CSS-only approximations)"

Do NOT run install — only show the command. User runs it themselves.

---

## Error states

| Situation                      | Response                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| `project.json` missing         | Offer to create empty scaffold (see DASHBOARD.md), then continue |
| `theme` section missing        | Create empty `theme: {}`, continue                               |
| User cancels at any step       | Exit cleanly, no writes                                          |
| Pack already set to same value | "Already using {pack}. Update anyway? Yes / No"                  |
