# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- `frontend-animations`: new skill — animation pack management with five packs (None / Subtle / Standard / Expressive / Playful), iOS/Apple easings, spring physics tokens (gentle/smooth/snappy/bouncy), named choreography compositions, and glass surface system. Writes `project.json#theme.motion.pack/spring/choreography/surfaces` via delta-write.
- `frontend-animations/references/packs.md`: complete JSON deltas for all five packs.
- `frontend-animations/references/ios-easings.md`: six canonical iOS/Apple cubic-bezier curves + three iOS duration tokens with provenance.
- `frontend-animations/references/spring-math.md`: spring physics conversion algorithm + per-library mapping table (React/Vue/Svelte/Solid/vanilla).
- `frontend-animations/references/choreography.md`: named composition library (entrance.float-in, success.pulse, success.confetti, attention.wiggle, error.shake, press.squeeze, loading.bob, route.ios-push, modal.ios-sheet, list.stagger-reveal, surface.tilt).
- `frontend-animations/references/preview-template.html`: swatch gallery populated at runtime to `.project/animation-preview.html`.
- `shared/DESIGN.md`: Glass surfaces opt-in section + Animation packs section; glassmorphism and bounce anti-patterns now conditional on opt-in flags.
- `shared/FRONTEND-RULES.md`: H205/H209 conditionalized; new rules H122, P110, A105.
- `shared/TOKENS.md`: iOS easing CSS vars, spring CSS var pairs, glass surface tokens, violation IDs T106/T107/T108.
- `shared/PATTERNS.md`: Motion patterns section — eight patterns including spring-press, glass-card, ios-modal-drawer, prefers-reduced-motion-fallback.
- `frontend-check/references/scan-motion.md`: Motion audit — seven checks M001–M007.
- `frontend-convert/examples/apple-style.md`: Expressive pack conversion example.

### Changed

- `shared/DASHBOARD.md`: `theme` schema extended with `motion.pack/axes/spring/choreography` and `surfaces`; merge strategy updated to DELTA-WRITE.
- `frontend-tokens/SKILL.md`: completeness check notes `motion.pack` owned by `/frontend-animations`; Next steps updated.
- `frontend-design/SKILL.md`: component schema gains `motion{}` field; page schema gains `transitions{}` field.
- `frontend-design/references/route-brief.md`: Motion plan block added to brief.
- `frontend-convert/SKILL.md`: SOURCE ANALYSIS template adds "Motion intent" field.
- `frontend-convert/references/generate-template.md`: reads `theme.motion.pack` and `$MOTION_INTENT` for output.
- `frontend-check/SKILL.md`: "Motion" scope added.
- `dev-build/SKILL.md`: Token-styled UI rule reads `theme.motion.pack` and applies transition tokens.
- `dev-verify/SKILL.md`: pre-walkthrough hint adds motion-pack advisory.
- `README.md`: frontend pipeline updated to include `/frontend-animations`.

- `inspect-overlay`: plain JS / static HTML install path — script-tag injection covering static sites, vanilla-Vite templates, and non-React frameworks (Vue/Svelte/Solid/Qwik). Always degraded mode.
- `inspect-overlay`: clipboard refs wrapped in `[…]` for clearer paste-context (single-click `[src/Button.tsx:42]`, multi-pin wraps each ref within the `--- 1/N ---` block).
- `README`: `## Inspect overlay` section documenting install, controls, and Full vs Degraded modes per stack.
- `README`: Pipelines table (dev / game / frontend / marketing) + `### Runtime state` sub-section introducing `/project-viewer`.
- `README`: CHANGELOG link in Quickstart step 4.
- `.claude/CLAUDE.md` + `CONTRIBUTING.md`: pre-tag validator step (`check-handoff.py` + `check-dashboard-writers.py`).

### Changed

- `mode-install.md` PHASE 0.1: framework detection adds `Plain` (no React/Next detected but `index.html` present) — only inspect-overlay is offered; PHASE 2-5 skipped.
- `setup-guide.md`: section "Setup — Vite" renamed to "Setup — Vite + React" for disambiguation with the new Plain JS path.

### Fixed

- `README` inspect-overlay controls: removed false floating-🔍-button claim; added complete keyboard table (Shift+Click, Drag, Ctrl+Z, Escape).
- `README`: removed `## Hooks` section — hooks are an implementation detail covered in `CLAUDE.md`.

---

## [1.3.0] - 2026-05-14

### Added

- `core-bootstrap`: Claude plan tier selection (Pro / Max 5x / Max 10x+) in PHASE 0; plan-aware `/model opusplan` + `effortLevel` tip in PHASE 3 report
- `core-bootstrap`: persists `preferences.claude_plan` in `.claude/paths.local.yaml` — re-runs skip the question; old-format files get the block backfilled automatically
- `core-bootstrap`: PHASE 0.5 writes `.claude/paths.local.yaml` with `projects_root` and `config_repo` (+ `godot_executable` on Windows); idempotent
- `core-update`: pull latest claude-config + rebuild `~/.claude/CLAUDE.md` and `settings.json` from base + personal overlay; preserves Language preference
- Personal overlay system (`personal/` directory, gitignored) — append `CLAUDE.md.overlay`, deep-merge `settings.overlay.json`, symlink `styles/`
- `core-bootstrap`: PHASE 1.5 detects and applies personal overlays; jq availability check in PHASE 0
- `core-write` / `core-rewrite`: dynamic style discovery from `~/.claude/styles/*.md`
- `skills/shared/styles/style-example.md`: generic style template for forks
- `personal/README.md.template`: setup guide for personal overlay
- `CONTRIBUTING.md`: skill conventions, naming, commit style
- `LICENSE`: MIT

### Fixed

- `skills/shared/references/lib/populate.js`: concept file now loaded when `conceptFile` flag is set, not only when `content` is empty
- `core-bootstrap` / `core-update`: portable `sed -i.bak` for BSD and GNU compatibility
- Three residual Dutch fragments translated in `core-create`, `dev-debug`, `shared/LEARNING-EXTRACTION.md`

### Changed

- `core-bootstrap`: fully idempotent — `--force` flag removed; existing files are never overwritten (delete manually to re-deploy)
- `core-bootstrap`: Language patch (PHASE 1) now also updates `"language"` in `~/.claude/settings.json` (jq preferred, sed fallback) to keep CLAUDE.md and settings.json in sync
- `README.md`: collapsed 13 H2 sections to 6; structure tree moved to `<details>` block; intro condensed; recommended-settings note defers plan-specific advice to `/core-bootstrap`
- `.claude/CLAUDE.md`: Platform table genericized — hardcoded machine-specific paths replaced with "configurable via env var or `paths.local.yaml`"
- `local/CLAUDE.md.base`: translated to English; `Language: English` default
- `local/settings.json.template`: safe defaults — `defaultMode: default`, `voiceEnabled: false`; removed `skipDangerousModePermissionPrompt`
- All skill/agent frontmatters: `author: mileszeilstra` → `author: claude-config`
- `README.md`: added Prerequisites, Install, Personal overlay sections; updated License
- `local/README.md`: translated to English; replaced hardcoded `C:\Projects\claude-config` with `<your-clone-path>`
- `agents/godot-tdd-implementer.md`: Godot exe path via `${CLAUDE_GODOT_EXECUTABLE}` env var with fallback
- `skills/core-rewrite/SKILL.md`: style option descriptions translated to English

### Removed

- `core-export` skill — built-in `/export` in Claude Code covers the use case better
- `skills/shared/styles/style-portfolio.md`, `style-personal.md`, `style-clear.md`, `_anti-patterns.md` — personal styles; use `personal/styles/` instead
- "Personal configuration — not intended for distribution" disclaimer from README
