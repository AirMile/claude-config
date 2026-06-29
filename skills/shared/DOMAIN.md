# DOMAIN — Design domain resolution (shared)

Single source of truth for **which rendering domain** the `design-*` skills target.
The design vocabulary (color, typography, spacing, motion, component spec, audit scope)
is domain-agnostic; only the **emit / render / scan** layer differs per domain. This file
defines how `/design-tokens`, `/design-create`, and `/design-check` resolve the active
domain so they load the matching renderer reference file.

## Domains

| Domain   | Status          | Emit / render target                                             |
| -------- | --------------- | ---------------------------------------------------------------- |
| `web`    | **default**     | CSS variables / Tailwind, React/TSX, Playwright runtime audit    |
| `game`   | **implemented** | Godot Theme `.tres`, Control-node scenes, static GDScript checks |
| `native` | placeholder     | iOS/Android (SwiftUI/Compose) — documented slot, **not built**   |

## Resolution order

Resolve `$DOMAIN` once in PREFLIGHT, then reuse it for every route:

1. **Explicit override** — if `project.json#theme.domain` is set (`"web" | "game" | "native"`),
   use it verbatim. This is sticky: it survives stack changes and is authoritative.
2. **Infer from stack** — else read `project.json#stack.framework` and `stack.language`:
   - `framework` matches `/godot/i` **or** `language` matches `/gdscript/i` → `game`
   - `framework` matches a web framework (`React`, `Next`, `Vue`, `Svelte`, `Angular`,
     `Astro`, `Remix`, `Nuxt`, `SolidJS`, `Qwik`) **or** `language ∈ {TypeScript, JavaScript}` → `web`
   - `framework`/`language` matches `/swift|swiftui|kotlin|compose|flutter|react native/i` → `native`
3. **Codebase fallback** — else if no usable `stack`: presence of `project.godot` → `game`;
   presence of `package.json` with a web framework dep → `web`.
4. **Ask** — if still ambiguous, AskUserQuestion:
   `"Which design domain is this project?"` → `Web (Recommended)` / `Game (Godot)` / `Native app`.

After resolving by inference (steps 2–4), **write the result back** to `theme.domain` so the
next run skips inference. Inference never overrides an explicit `theme.domain`.

## Native domain guard

`native` is a reserved, documented slot — no renderer is implemented yet. If resolution yields
`native`, the design skills print one line and fall back:

> `⚠ Native domain (SwiftUI/Compose) has no renderer yet — falling back to spec-only. No code emitted.`

`/design-tokens` still writes the domain-neutral vocabulary tokens (usable by any future
renderer); `/design-create` and `/design-check` do spec/static work only and emit no native code.

## Renderer reference files per skill

Each design skill branches on `$DOMAIN` and loads the matching reference:

| Skill            | `web` (default)                            | `game`                                 |
| ---------------- | ------------------------------------------ | -------------------------------------- |
| `/design-tokens` | `route-apply.md` + `website-sync.md` (CSS) | `references/emit-godot.md` (`.tres`)   |
| `/design-create` | `route-convert.md` + `CODEGEN.md` (TSX)    | `references/render-godot.md` (`.tscn`) |
| `/design-check`  | `references/scan-*.md` (Playwright)        | `references/scan-godot.md` (static)    |

The `web` path is the historical behaviour (the de-facto web renderer) — no separate
`emit-web.md` indirection layer; the existing web references _are_ the web renderer.
