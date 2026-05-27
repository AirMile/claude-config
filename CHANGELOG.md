# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Changed

- **BREAKING**: Renamed `concept` → `seed` throughout the dashboard, `project.json` schema, and all skill references. `project.json#concept` → `#seed`, `backlog.html#data.flags.hasConcept/conceptPath` → `hasSeed/seedPath`, `.project/project-concept.md` → `project-seed.md`. All skill references updated (`core-setup`, `shared/SEED.md`, `shared/SYNC.md`, `project-seed`, `project-brainstorm`, `project-critique`, `project-backlog`, `dev-define`, `game-define`, `project-todo`). Migration script: `scripts/migrate-concept-to-seed.cjs` (idempotent). Rationale: align data-field naming with the `/project-seed` skill.
- `frontend-tokens` v4.0.0: **BREAKING** — merged `frontend-animations` into `frontend-tokens`. Motion Pack routes (pick pack, customize, preview, apply, view, delete) now live under `/frontend-tokens → Motion Pack`. All animation references moved to `skills/frontend-tokens/references/motion/`. `frontend-animations` skill removed. Auto-trigger via `THEME/defining` backlog transition now also covers motion pack setup. PHASE 0 expanded with pack-rename check, MIGRATE_OFFER, and stack detection. No delta-write boundary between skills anymore — `frontend-tokens` owns the full `theme` object. All cross-references updated.

### Added

- `frontend-design` v2.11.0: Design route Build-fase krijgt external setup context (identiek aan Convert Step 0 — WebFetch Vercel-guidelines als JSX-bias). Build-conditioneel (Capture/Brief skippen de fetch). Schrijft `theme.setupContext[]` entry met `appliedBy: frontend-design@2.11.0` na succesvolle codegeneratie.
- `frontend-tokens` v3.8.0: PHASE 0 staleness-check — niet-blokkerende waarschuwing wanneer `theme.setupContext` entry ouder dan 180 dagen is. Fires op alle routes behalve Create.
- `frontend-design` v2.10.0: Convert route now includes Step 0 — WebFetch of `vercel-labs/web-interface-guidelines` as JSX-level bias context (tabular-nums, focus-visible, no transition:all, curly quotes, aria-label on icon buttons). Soft-fail on network error. DESIGN.md remains canon. Writes `theme.setupContext[]` entry on success.
- `frontend-tokens` v3.7.1: traceability — Step 8 now appends-or-replaces `theme.setupContext[]` entry when Step 0 succeeded (`{source, url, fetchedAt, appliedBy}`). Summary block shows `Setup context` row. Schema documented in `shared/DASHBOARD.md`.
- `frontend-tokens` v3.7.0: Create route now WebFetches `vercel-labs/web-interface-guidelines` as bias context (Step 0) for generating colors/typography/motion/interaction defaults. Soft-fail on network error. DESIGN.md remains project canon; Vercel serves as external authority only at setup time.
- `frontend-tokens` v3.6.0: condensed `SKILL.md` from 598 → 166 lines via lazy-loading. Moved PHASE 1 action-selection (3 menu variants + completeness check) to new `references/phase-1-action-select.md`, Fill-In route to `references/route-fill-in.md`, JSON schema + Read/Write protocol to `references/THEME_TEMPLATE.md`. Removed Mermaid state machine, duplicate Resources blocks, verbose ALWAYS/NEVER list, and Output Contract prose. Behaviour and all 7 routes unchanged.
- `frontend-design` v2.9.0: merged `frontend-convert` into `frontend-design` as a lazy-loaded Convert route (`references/route-convert.md`). Existing design body moved to `references/route-design.md`. `SKILL.md` is now a thin router (~174 lines) that dispatches on visual-input detection vs spec-entity name. A design session never loads convert content and vice versa.
- `frontend-design/references/route-design.md`: full design-spec workflow (Capture/Brief/Build) extracted from the old SKILL.md skeleton.
- `frontend-design/references/route-convert.md`: full visual-conversion workflow from `frontend-convert`.
- `frontend-design/references/convert-patch-detection.md`, `convert-generate-template.md`, `convert-verification-loop.md`, `convert-completion.md`: convert sub-references migrated from `frontend-convert/references/`.
- `frontend-design/examples/`: conversion examples migrated from `frontend-convert/examples/`.

### Removed

- `frontend-convert` skill (49 skills total). All `/frontend-convert` entry points now resolve to `/frontend-design`.

### Added (previous)

- `frontend-animations`: new skill — animation pack management with five packs (None / Subtle / Standard / Apple / Playful), multi-source easings (Apple iOS · Material Design 3 · Fluent 2 · IBM Carbon · web baseline), spring physics tokens, named choreography compositions, and glass surface system. Writes `project.json#theme.motion.pack/spring/choreography/surfaces` via delta-write.
- `frontend-animations/references/packs.md`: complete JSON deltas for all five packs with source credits per pack.
- `frontend-animations/references/ios-easings.md`: six canonical iOS/Apple cubic-bezier curves + three iOS duration tokens with provenance.
- `frontend-animations/references/spring-math.md`: spring physics conversion algorithm + per-library mapping table; now includes Material Design 3 spatial and effects springs.
- `frontend-animations/references/material-motion.md`: Material Design 3 emphasized/standard curves, 14-step duration scale, spatial/effects springs, container-transform/shared-axis/fade-through patterns.
- `frontend-animations/references/fluent-motion.md`: Microsoft Fluent 2 four curves, seven duration tokens, reveal/occlude patterns for Windows 11-style apps.
- `frontend-animations/references/carbon-motion.md`: IBM Carbon entrance/exit curve pair, six productive/expressive duration tokens, data-table row reveal and notification patterns.
- `frontend-animations/references/web-baseline.md`: Linear/GitHub/Vercel/Stripe observed-in-the-wild curves (ease-expo-out, ease-cubic-out), hover and dropdown patterns, skeleton shimmer.
- `frontend-animations/references/choreography.md`: named composition library (entrance.float-in, success.pulse, success.confetti, attention.wiggle, error.shake, press.squeeze, loading.bob, route.ios-push, modal.ios-sheet, list.stagger-reveal, surface.tilt) + Material 3 container-transform / shared-axis / fade-through + Fluent reveal.
- `frontend-animations/references/preview-template.html`: swatch gallery populated at runtime to `.project/animation-preview.html`; now conditionally renders five source-specific sections (iOS, Material 3, Fluent 2, IBM Carbon, web baseline) based on `motion.easings[]` token prefixes — Standard-pack preview shows Material rows, Apple-pack shows iOS rows.
- `shared/DESIGN.md`: Glass surfaces opt-in section + Animation packs section; glassmorphism and bounce anti-patterns now conditional on opt-in flags.
- `shared/FRONTEND-RULES.md`: H205/H209 conditionalized; new rules H122, P110, A105.
- `shared/TOKENS.md`: iOS/Apple, Material 3, Fluent 2, Carbon, and web-baseline easing CSS vars; spring CSS var pairs; M3 duration scale; Fluent 2 duration scale (`--duration-fluent-ultra-fast` → `--duration-fluent-ultra-slow`, seven tokens); glass surface tokens; violation IDs T106/T107/T108.
- `shared/PATTERNS.md`: Motion patterns section — fourteen patterns including spring-press, glass-card, ios-modal-drawer, prefers-reduced-motion-fallback, material.container-transform, material.shared-axis, material.fade-through, fluent.reveal, carbon.data-row-reveal, carbon.notification-stack.
- `frontend-check/references/scan-motion.md`: Motion audit — seven checks M001–M007.
- `frontend-convert/examples/apple-style.md`: Apple pack conversion example.
- `frontend-animations/references/route-create.md`: Step 1.5 decision guide — five-question app-type prompt that suggests a pack and optional Customize step before the enum.

### Changed

- `frontend-design/SKILL.md`: PHASE 0.3 router gains backlog-transition lookup (new Step 3) — named arguments matching a backlog card with `transition === "converting"` now auto-route directly to the Convert route, skipping the Mode A menu. Honors the board's "⌅ Convert from sketch" intent without requiring an extra interaction.

- `shared/DASHBOARD.md`: `theme` schema extended with `motion.pack/axes/spring/choreography` and `surfaces`; merge strategy updated to DELTA-WRITE.
- `frontend-tokens/SKILL.md`: completeness check notes `motion.pack` owned by `/frontend-animations`; Next steps updated.
- `frontend-design/SKILL.md`: component schema gains `motion{}` field; page schema gains `transitions{}` field.
- `frontend-design/references/route-brief.md`: Motion plan block added to brief.
- `frontend-convert/SKILL.md`: SOURCE ANALYSIS template adds "Motion intent" field.
- `frontend-convert/references/generate-template.md`: reads `theme.motion.pack` with per-pack branches (subtle/standard/apple/playful) and `$MOTION_INTENT` for output.
- `frontend-check/SKILL.md`: "Motion" scope added.
- `dev-build/SKILL.md`: motion token enforcement rule added — per-pack transition classes (subtle/standard/apple/playful), T106/T107 lint, reduced-motion wrapper.
- `dev-verify/SKILL.md`: pre-walkthrough hint adds motion-pack advisory.
- `README.md`: frontend pipeline updated to include `/frontend-animations`.
- `frontend-animations/SKILL.md`: pack enum updated (`expressive` → `apple`); PHASE 0 pack-rename migration check; references section extended with four new source files; Customize route extended with "Add easings from other systems" step.
- `frontend-animations/references/packs.md`: Standard pack adopts Material Design 3 (ease-md-_ + spring-md-spatial/effects + duration-md-_ subset); Subtle pack adopts web baseline (ease-expo-out/cubic-out); Apple pack (renamed from `expressive`) retains iOS curves; Playful pack gains spring-md-spatial + ease-md-emphasized; source credits per pack header.
- `frontend-animations/references/route-create.md`: pack options show source credits; Step 1.5 decision guide added; Step 3 condition updated to `apple/playful`; write logic pack-agnostic.
- `frontend-animations/references/route-customize.md`: new Step 4 "Add easings from other systems" — injects Fluent 2 / Carbon / Material 3 easings into `motion.easings[]` without changing active pack.
- `shared/TOKENS.md`: Material 3 duration scale (14 tokens), Material 3 easings (ease-md-_), Material 3 spring CSS vars, web-baseline easings (ease-expo-out/cubic-out), Fluent 2 easings (ease-fluent-_) + seven Fluent duration tokens, Carbon easings (ease-carbon-\*) added to `:root` block and Tailwind config.
- `shared/PATTERNS.md`: spring-press / view-transition-route / glass-card / ios-modal-drawer conditions updated to `apple/playful`; six new patterns: material.container-transform, material.shared-axis, material.fade-through, fluent.reveal, carbon.data-row-reveal, carbon.notification-stack.

### Fixed

- `frontend-animations/references/route-apply.md`: iOS easing gate corrected (`expressive` → `apple`); added per-pack emit blocks for Material Design 3 (standard/playful), web baseline (subtle), and Customize-injected Fluent/Carbon easings — Standard-pack projects now correctly receive `--ease-md-*`, `--duration-md-*`, `--spring-md-*` vars in `theme.cssVars`. Added `/* End animation pack */` close-sentinel for deterministic re-emit.
- `shared/TOKENS.md`: `--duration-fluent-*` seven duration tokens added (previously referenced in `PATTERNS.md:fluent.reveal` with fallback values but never declared).
- `frontend-check/references/scan-motion.md`: M001 regex extended to catch `transition: all 0.3s ease`, seconds-syntax durations (`0.3s`), and `transition-duration` property — the most common hardcoding patterns were previously missed.

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
