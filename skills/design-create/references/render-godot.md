# design-create — Render to Godot (game domain)

Loaded for the **code-generation step** when `$DOMAIN === "game"` (see `shared/DOMAIN.md`). It is
the game-domain counterpart of the web codegen (`shared/CODEGEN.md` + `FRONTEND-RULES.md`, which
emit React/TSX). It turns the **domain-neutral design spec** (`project.json#design`) into Godot
4.x **UI scenes** (`.tscn`) built from `Control` nodes that consume the generated Theme.

## Honest scope — what shrinks vs web

- **No visual capture.** There is no meaningful Figma/URL/screenshot → Godot path (Playwright
  captures a DOM; Godot has none). The **Convert route is web-only.** The game path is
  **spec → scene-codegen only**: it builds from `project.json#design` (pages, components, flows,
  layout), not from an image. If a user passes an image/URL on a game project, explain this and
  fall back to the Design route (capture the intent into the spec first, then generate).
- **No responsive breakpoints.** Layout uses Godot anchors + Container nodes, not media queries.
- **Tokens come from the Theme**, never inlined (read via `get_theme_color(...)` / the `Palette` type, not hardcoded `Color(...)` / `font_size`).

## Inputs

- `project.json#design.{pages|components}[name]` — the spec to generate (sections, layout, components).
- `project.json#theme.godotTheme.resourcePath` — the `Theme` `.tres` from `/design-tokens` emit-godot.
- Existing `*.tscn` components for reuse (instance via `PackedScene`).

## Output

- A scene per page/component under `res://ui/scenes/{name}.tscn` (reuse the project's existing UI
  scene dir if one exists). Reusable components → `res://ui/components/{name}.tscn`.
- Each root UI node sets `theme = ExtResource(<main.tres>)` so all children inherit tokens.

## Layout-semantics → Godot node mapping

| Spec layout           | Godot node                                   |
| --------------------- | -------------------------------------------- |
| single column / stack | `VBoxContainer`                              |
| row / inline          | `HBoxContainer`                              |
| grid                  | `GridContainer` (set `columns`)              |
| sidebar + content     | `HSplitContainer`                            |
| centered / overlay    | `CenterContainer` / `Control` + anchors      |
| scrollable region     | `ScrollContainer` + inner container          |
| card / surface        | `PanelContainer` (styled via Theme StyleBox) |

Component primitives → `Button`, `Label`, `LineEdit`, `TextureRect`, `RichTextLabel`. Spacing →
`theme_override_constants/separation` only when a one-off override is needed; prefer the Theme's
container constants. Sizing → anchors + `size_flags_horizontal/vertical` (fill/expand/shrink),
mirroring the spec's fixed/fill/hug semantics.

## `.tscn` template (Godot 4.x, `format=3`)

```
[gd_scene format=3]

[ext_resource type="Theme" path="res://ui/theme/main.tres" id="1_theme"]
[ext_resource type="PackedScene" path="res://ui/components/card.tscn" id="2_card"]

[node name="MainMenu" type="Control"]
layout_mode = 3
anchors_preset = 15
theme = ExtResource("1_theme")

[node name="Body" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = 8
theme_override_constants/separation = 16

[node name="Title" type="Label" parent="Body"]
text = "Welcome"

[node name="PlayButton" type="Button" parent="Body"]
text = "Play"
```

- `anchors_preset = 15` = full rect; `8` = center. `layout_mode = 3` (anchors) on the root,
  `1` for anchored children inside containers.
- Reuse a component: `[node name="Card" parent="Body" instance=ExtResource("2_card")]`.
- Header format (Godot 4.x, verified against the stable docs): `[gd_scene format=3]`. **Do not emit
  `load_steps`** — deprecated as of Godot 4.6; the engine recomputes it on save. `uid="..."` is
  optional in hand-authored scenes (Godot generates one on import).

## Spec sync + handoff

- Write/merge the generated entity into `project.json#design.{pages|components}[name]` (same spec
  contract as web — universal). Record the generated `.tscn` path on the spec entry.
- Stub interactions (button `pressed` with no handler script) → gap-discovery suggests a game
  FEATURE/MECHANIC todo, mirroring the web `frontend→dev` gap flow (see `shared/SKILL-PATTERNS.md`).
- Runtime/feel verification → `/game-ship` (playtest phase). (Static Theme-consistency has no separate audit skill — the former `/design-check` game path was removed; keep tokens Theme-sourced at generation time.)

## native domain

Documented slot only — no scene-codegen. Capture into the spec and stop (see `shared/DOMAIN.md`).
