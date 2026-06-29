# design-tokens — Emit to Godot (game domain)

Loaded by the **Apply / Website-Sync** step when `$DOMAIN === "game"` (see `shared/DOMAIN.md`).
It is the game-domain counterpart of the web emit (`route-apply.md` + `website-sync.md`): it
translates the domain-neutral vocabulary tokens in `project.json#theme` into **Godot 4.x
resources** and records their paths in `theme.godotTheme`.

## Inputs → outputs

**Input:** `theme.colors`, `theme.typography`, `theme.spacing`, `theme.borderRadius`,
`theme.shadows`, `theme.motion` (springs/durations), `theme.modes` (for dark variant).

**Output** (written into the Godot project, under `res://ui/theme/` by default):

| File                 | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `main.tres`          | `Theme` resource — colors, fonts, StyleBoxes for common controls |
| `main_dark.tres`     | Dark Theme variant (only if `modes.dark` or dark colors exist)   |
| `fonts/{token}.tres` | `FontFile`/`SystemFont` per typography family                    |
| `motion_tokens.gd`   | Autoload exposing duration/spring tables for `Tween` use         |

Then write `theme.godotTheme = { resourcePath, darkResourcePath?, fonts[], motionScript, generatedAt }`.
`generatedAt` is stamped after the run (do not invent a clock mid-run — use the real timestamp
when writing back).

## Project-root + path resolution

`res://` = the directory containing `project.godot`. Resolve it once:

1. Find `project.godot` (repo root or a subdir). Its directory is the Godot project root.
2. Default output dir: `<godot-root>/ui/theme/`. If the project already has a theme dir
   (grep `*.tres` with `type="Theme"`), reuse that location instead of creating a new one.
3. If no `project.godot` exists, this is not a Godot project — abort and re-check `$DOMAIN`.

## Value conversion (CSS → Godot)

Godot uses **pixels as numbers** and **`Color(r,g,b,a)` in 0..1 floats**. Convert:

- **Color:** `#RRGGBB` → `Color(R/255, G/255, B/255, 1)`; `#RRGGBBAA` → include alpha. Round to
  ~3 decimals. `oklch(...)`/`color-mix(...)` → resolve to the nearest sRGB hex first, then convert.
- **Length:** `"16px"` → `16`. `"1rem"` → `spacing.base`-relative; treat `1rem = 16px` unless
  `theme.spacing.base` says otherwise → multiply. Drop the unit; Godot wants a number.
- **Shadows:** CSS `box-shadow` → `StyleBoxFlat.shadow_color` + `shadow_size` (+ `shadow_offset`
  if the CSS has x/y). Blur radius ≈ `shadow_size`.
- **Motion / easings:** **not** representable in a `Theme`. cubic-bezier/spring/duration tokens go
  into `motion_tokens.gd` instead (see below). Theme carries no animation.

## Theme mapping rules

Map tokens to the controls a typical UI uses — do not enumerate every Godot control. Cover at
least `Button`, `Label`, `Panel`, `LineEdit`, plus `default_font`/`default_font_size`:

- **Colors** → `default_color`/per-control color items: accent-primary → `Button/colors/font_color`
  background, main `dark`/`light` → `Label/colors/font_color` and `Panel` bg, semantic colors →
  exposed as named entries under a custom theme type (`Palette/colors/{token}`) so game code can
  read them via `theme.get_color("success", "Palette")`.
- **Typography** → one `FontFile` (or `SystemFont`) per `families.*`; set `default_font` to body,
  `default_font_size` to the base size; map `sizes[]` to per-control `font_size` constants
  (e.g. `Button/font_sizes/font_size`).
- **Spacing** → `StyleBoxFlat.content_margin_*` on Button/Panel/LineEdit styleboxes, using the
  `spacing` scale (e.g. component padding token → button content margins).
- **Border radius** → `StyleBoxFlat.corner_radius_*` (all four corners) from `borderRadius`.
- **Shadows** → `StyleBoxFlat.shadow_color` + `shadow_size` on elevated styleboxes (Panel, Button hover).

## `.tres` template (Godot 4.x, `format=3`)

```
[gd_resource type="Theme" format=3]

[ext_resource type="FontFile" path="res://ui/theme/fonts/inter.tres" id="1_body"]

[sub_resource type="StyleBoxFlat" id="SB_button_normal"]
bg_color = Color(0.231, 0.51, 0.965, 1)
corner_radius_top_left = 6
corner_radius_top_right = 6
corner_radius_bottom_right = 6
corner_radius_bottom_left = 6
content_margin_left = 16.0
content_margin_right = 16.0
content_margin_top = 8.0
content_margin_bottom = 8.0
shadow_color = Color(0, 0, 0, 0.1)
shadow_size = 4

[resource]
default_font = ExtResource("1_body")
default_font_size = 16
Button/colors/font_color = Color(1, 1, 1, 1)
Button/styles/normal = SubResource("SB_button_normal")
Label/colors/font_color = Color(0.102, 0.102, 0.18, 1)
Palette/colors/success = Color(0.063, 0.725, 0.506, 1)
```

Header format (Godot 4.x, verified against the stable docs): `[gd_resource type="Theme" format=3]`.
The `uid="..."` attribute may be omitted in hand-authored resources — Godot generates one on first
import. **Do not emit `load_steps`**: it is deprecated as of Godot 4.6 and the engine recomputes it
on save. (Only pre-4.6 files carry it; if you must target <4.6, set it to `ext_resource` +
`sub_resource` count + 1.)

## Dark mode

No CSS cascade in Godot. If `modes.dark` (or a dark color set) exists, emit a **second** Theme
resource `main_dark.tres` with the dark color values, and record `darkResourcePath`. The game
swaps `Control.theme` (or `ThemeDB` default) at runtime to switch modes. Do not try to encode
both modes in one Theme.

## Motion autoload (`motion_tokens.gd`)

Theme cannot hold timing. Emit a small autoload so game code drives `Tween`s from the same tokens:

```gdscript
# motion_tokens.gd — generated from project.json#theme.motion. Do not edit by hand.
extends Node

const DURATIONS := { "fast": 0.2, "base": 0.3, "slow": 0.5 }  # seconds (ms/1000)

# Springs: Godot has no built-in spring Tween. Use stiffness/damping with a helper,
# or approximate with TRANS_BACK/EASE_OUT. cssApprox is web-only and dropped here.
const SPRINGS := {
	"snappy": { "stiffness": 300, "damping": 25, "mass": 1 },
}
```

Durations convert ms → seconds (Godot `Tween` uses seconds). Springs carry the physics params;
the `cssApprox`/`cssDuration` fields are web-only and omitted.

## Honesty — what shrinks vs web

- **Glass / backdrop-filter:** no native equivalent → `surfaces.glass` cannot be emitted; note it
  in the report as unsupported (a custom shader is out of scope).
- **Breakpoints / responsive:** Godot uses anchors/containers, not media queries → `breakpoints`
  are informational only, not emitted.
- **Motion easings as curves:** only durations + spring params transfer; CSS cubic-beziers do not.

Report these as `— (game domain: not applicable)` rows rather than silently dropping them.
