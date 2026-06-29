# design-check — Game-domain audit (static + delegation)

Loaded when `$DOMAIN === "game"` (see `shared/DOMAIN.md`). Godot projects have **no browser
runtime**, so the Playwright/Lighthouse/axe scans do not apply. This route runs a **static**
design-consistency check and **delegates the runtime/playtest pass to `/game-verify`** — it does
not launch Godot, render frames, or screenshot. Output uses the same finding format as the web
scans (severity · rule · file · issue · fix), so PHASE 2/3/4 are unchanged.

## Inputs

- `project.json#theme` — vocabulary tokens + `theme.godotTheme` (the generated `.tres` path).
- `project.json#design.principles[].forbid` + `design.banPacks` — project design rules.
- Project files: `*.gd` (scripts), `*.tscn` (scenes), `*.tres` (resources).

## Static checks

### G1 — Token adherence (no hardcoded design values)

Grep `.gd` and `.tscn`/`.tres` for design literals that bypass the generated Theme:

- `Color(<floats>)` or `Color8(...)` / hex color strings in scripts/scenes that duplicate a
  `theme.colors` token → should read from the Theme (`get_theme_color(...)`) or the `Palette`
  type, not inline. Flag with the matching token name.
- Hardcoded `font_size = <n>` / `add_theme_font_size_override(...)` matching a `typography.sizes`
  token → should come from the Theme.
- Hardcoded margins/padding (`content_margin_*`, `offset_*`, `custom_minimum_size`) matching a
  `spacing` token → should come from a Theme StyleBox.

Allow values that have **no** token equivalent (genuinely one-off) — flag only literals that
shadow an existing token. Severity: warning (consistency), not critical.

### G2 — Theme wiring

- Root `Control`/`CanvasLayer` UI scenes should set `theme = ExtResource(<main.tres>)` (or inherit
  it). Flag UI scenes with no Theme reference and inline per-node overrides instead.
- Per-control `theme_override_*` entries that exactly duplicate a Theme value → redundant; flag.

### G3 — Design-principle adherence

Apply `design.principles[].forbid` and `design.banPacks` to game UI the same way Convert enforces
them for web: scan generated/edited UI scenes/scripts for banned patterns. Report violations.

### G4 — Dark variant coverage

If `theme.modes.dark` (or a dark color set) exists but `theme.godotTheme.darkResourcePath` is
absent, or no runtime theme-swap path is wired → flag (dark mode declared but not emitted/wired).

### G5 — Resource integrity

- `theme.godotTheme.resourcePath` (and `darkResourcePath`, `fonts[]`, `motionScript`) exist on disk
  under the Godot project root.
- Referenced `ext_resource` paths inside the `.tres` resolve (no broken `res://` links).

## Delegation to /game-verify

Runtime concerns — does it look/feel right, animations, input, framerate, actual rendering — are a
**human playtest**, owned by `/game-verify`. After the static report, print:

> `Runtime/playtest pass → run /game-verify (human playtest). design-check does not render Godot.`

Do **not** attempt headless Godot screenshots or frame analysis here.

## Not applicable in game domain (report as N/A, don't silently drop)

- Performance: CWV/Lighthouse — web-only. (Godot perf = profiler/framerate, via `/game-optimize`.)
- Responsive: 6-viewport overflow — Godot uses anchors/containers, not media queries.
- A11Y: axe/aria/focus-trap — no DOM. (Godot a11y is a separate concern, out of scope.)
- SEO/AEO: not applicable to a game build.
- Darkmode pixel-diff / reduced-motion emulation: no browser to emulate.

List these as `— (game domain: N/A)` rows in the report so coverage is explicit.
