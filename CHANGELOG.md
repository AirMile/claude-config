# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **Visual design review route** — a wireframe + spec + editable open-questions view for any PAGE/COMPONENT, served by the existing board server (`serve-backlog.js`) with no new dependency. Borrows the useful idea from BuilderIO's `visual-plan` skill (review artifact with open-question blocks that write back to source) but on the local-first stack instead of MDX + a hosted MCP. New `serve-backlog.js` routes: `GET /{project}/review/{entity}` (renders the new `review-template.html` with the design spec injected), `GET /{project}/review/{entity}/data` (JSON: spec + reviewNotes), `POST /{project}/review/{entity}/save` (persists `reviewNotes[]`). The template renders `pages[].sections` (PAGE) or the variant/size/state matrix (COMPONENT) as wireframe boxes, a read-only spec panel, and an open-questions form; SSE live-reload mirrors the dashboard. New user-owned schema field `design.{pages|components}[].reviewNotes[]` (`{ question, answer, status, at }`) documented in `shared/DASHBOARD-PROJECT.md` — `frontend-design` merges never touch it. Two entry points: the backlog board card gains a "▦ Bekijk design →" menu item for PAGE/COMPONENT tasks (`backlog-template.html`), and the `frontend-design` flow prints the clickable `http://localhost:9876/...` review URL at its gates (Build Step 2.5, Convert scope gate, and the Design-route Capture/Edit completion in `completion-sync.md`). `project-viewer` docs list the new route.
- `frontend-content` v1.0.0: new skill — fills built pages/components with real, on-brand copy via a 6-phase intentional pipeline: pre-flight & modus (board / arg / queue-batch) → scope & intent (archetype classification: marketing / transactional / functional; content-brief from seed+theme+entities; Interview Checkpoint; optional `/marketing-research` consume/offer hook) → scan (placeholder detection + copy-in-JS-logic: toast/validation/error strings + `aria-label`/`alt` + metadata fields, KEEP-marking existing real copy) → generate (UX-writing rules from `DESIGN.md`, archetype-tuned, glossary-consistent; PAGE targets also get `<title>`/meta-description/OG copy in the detected framework convention) → review & approve (before→after table; Apply all / Edit per item / Regenerate-tone loop / Cancel) → apply + sync (inline or i18n-file, cross-page glossary persisted to `project.theme.voice.terms`, backlog `contentStatus: "filled"` + transition clear). Slots between `frontend-design` and `frontend-check`; adds `"contenting"` transition to the PAGE/COMPONENT lifecycle. Board shows "Fill content" button and `copy: placeholder` badge for built-unfilled items (`stage === "built" && contentStatus !== "filled"`). `project-backlog` unchanged — no separate CONTENT items, content is a pipeline stage on the existing PAGE/COMPONENT task. Lazy-loaded references: `scope-intent.md`, `content-generation.md`, `review-gate.md`, `apply-and-sync.md`.

### Fixed

- `frontend-design` (`build-completion-sync.md`, `convert-completion.md`): `contentStatus` is now cleared (`delete feature.contentStatus`) wherever `stage: "built"` is written — Build PASS/SKIPPED branches and Convert Page scope. Previously a page that was rebuilt or re-converted kept `contentStatus: "filled"` in the backlog, hiding the "Fill content" button/badge even though the new markup contained fresh placeholders. Analogue to how `frontend-check` invalidates `lastCheckedSha` on rebuild.

### Changed

- `project-retire` v1.0.0: new skill — safely retire a **built** feature from code + backlog + memory. Core-delete safety pattern: impact analysis via the `architecture.components[].connects_to` dependency graph plus import/symbol grep, CRITICAL/WARNING/INFO impact report with explicit confirm, optional `retire/{feature}` branch isolation, full-suite test gate with complete rollback (git reset + `.project/` memory snapshots), memory sync (backlog → CANCELLED + `cancelledReason`/`cancelledAt`, component removal with dangling-edge strip, learnings **archived + tombstone** — never deleted, seedDrift `contradiction` entry for `/project-seed` sync, feature-dir archive). Stack-agnostic (web + game via stack detection) — no dev/game pair needed.
- `shared/PROJECT-CONTEXT-LOAD.md`: new `ideation` profile — compact built-state (dataFlow + components as name/layer/status/feature, cap 40) and backlog summary (status counts + active items, cap 40), ~600–900 tokens.
- `shared/INPUT-PARSING.md § Project Memory Load`: shared memory-load hook for the ideation skills — ideation profile + scope-dependent learnings (LEARNINGS-LOAD) + prior-thinking grep (filenames + H1 only) composed into one `PROJECT MEMORY` block, with the behavioral rule that built components and DOING/DONE items are existing reality to ideate around, not re-propose.

### Changed

- `shared/FINALIZE.md`: frontend-track finalize no longer jumps over the **TO CHECK** gate. Finalize is now a pure merge/cleanup step that **never promotes `DOING` → `DONE`** — mirroring dev-track, where `/dev-verify` finalize is forbidden from writing `shipped` and `/dev-refactor` ships. New per-type backlog sync: **COMPONENT** is left untouched (ships with its consuming page, matching `/frontend-check`'s rule); **PAGE** gets `shipped`/`shippedSha` stamped **only when already `DONE`** (`/frontend-check` PASS), otherwise it stays at `DOING` with a "run /frontend-check to ship" hint. Fixes a built COMPONENT (e.g. `code-block`) auto-jumping to `DONE`+`shipped` when `/core-finalize` ran before `/frontend-check`. One fix covers all finalize paths (`core-finalize`, `frontend-check` PHASE 5, `frontend-design` §4.6). `shared/BACKLOG.md` frontend-track lifecycle docs updated to match.
- `frontend-design` convert route (`convert-completion.md` §4.6): de-duplicated the inline finalize-decision matrix + offer modals — now delegates to `shared/FINALIZE.md → Finalize Offer Decision` with `feature-name = $CONVERT_TARGET`, the same single-source delegation `dev-verify` uses. Removes a drifting copy of the matrix; the `/core-finalize` deferred messages now come from the shared source.
- `frontend-design` convert route (`convert-completion.md` §4.2): a converted PAGE now lands at `DOING` (TO CHECK) instead of jumping straight to `DONE`, matching the Build route. `/frontend-check` is now the **sole gate to `DONE`** for pages (build and convert alike) — closing a gap where converted pages were marked `DONE` without ever running the runtime audit (Lighthouse/CWV, axe-runtime a11y, responsive, darkmode, error states, SEO, flow), which convert's visual-fidelity loop does not cover. Also fixes a self-contradiction: the completion report told the user to "run /frontend-check", but `status: DONE` made the batch (`status === "DOING"` filter) skip the page. Convert's visual verification loop stays as a complementary pre-check. COMPONENT scope already landed at `DOING` — unchanged; patch-mode unaffected.
- `frontend-check` v3.1.0: batch mode lifted to `dev-refactor` parity. `/frontend-check` with no argument now drives a single combined flow via new lazy-loaded `references/batch.md`: queue confirmation (auto ≤3 / pick >3), sequential scan + triage (CLEAN vs HAS_FINDINGS), **one** combined cross-feature report (FEATURE ROLLUP + PER-AXIS TOTALS + COMBINED PRIORITIES), **one** fix-scope approval (All C+H / CRITICAL only / Everything / Choose per feature) instead of N per-feature prompts, all-clean early-exit (write `lastCheckedSha` only), per-feature fix with shared-file **snapshot rollback** (`/tmp/check-snapshot-*`), and a single `audit(batch): …` commit (baseline `pre-check-status.txt`). Batch fixes run on the current branch (no per-feature worktree); scans stay sequential (shared Playwright browser). PAGE→DONE/shipped + COMPONENT-only-`lastCheckedSha` logic reused from `fix-reaudit.md § 4.3`. Single-target mode unchanged. Backlog board: the **"To check"** column (DOING, frontend track) gains a `batch (N)` button that copies `/frontend-check` and marks features `transition: "checking"` — `backlog-template.html` `isFrontendSection` now keys on `batchSkill === "check"` (dead `"convert"`/`"audit"` anticipations removed; `"audit"` had built the wrong `/frontend-audit`).
- `core-bootstrap`: new **Permission mode** selection (PHASE 0) — Bypass permissions (Recommended, because all skills run within guard rails: plan mode, security-reminder + format-on-save hooks, explicit handoff contracts) vs Auto mode. Follows the `Language` pattern: `local/settings.json.template` now ships the recommended bypass posture (`defaultMode: "bypassPermissions"` + `disableAutoMode: "disable"` + `skipDangerousModePermissionPrompt: true`), so the recommended choice is a no-op; the Auto-mode choice patches settings.json (PHASE 1, jq-preferred) to `defaultMode: "auto"`, drops the bypass-only flags, and pre-accepts the auto-mode opt-in (`skipAutoPermissionPrompt: true`). Idempotent — skipped when `~/.claude/settings.json` already exists. New "Permission mode" row in the PHASE 3 report.
- `project-viewer` v3.3.0: self-healing root detection. `serve-backlog.js` gains a `GET /__root` health endpoint returning the active `PROJECTS_ROOT`; PHASE 1 now compares it against the resolved `$root` and **restarts** a running server bound to a stale root (e.g. an old `projects_root` from a moved projects folder) instead of unconditionally jumping to PHASE 2. Fast path preserved when roots match — no restart, open boards/SSE stay alive. Fixes the empty index that occurred when a server kept scanning an outdated path. PHASE 1 also validates the resolved `$root` on disk: when it does not exist, the skill prompts for a new path and persists it to `paths.local.yaml` (the source of truth) before (re)starting — so a stale projects root can be corrected straight from `/project-viewer`. `core-bootstrap` PHASE 0.5 applies the same validation to an existing `paths.local.yaml#projects_root` (still idempotent when the path is valid).
- `project-seed` v1.7.0, `project-brainstorm` v2.1.0, `project-critique` v2.1.0: memory-aware ideation — all three load the `PROJECT MEMORY` block in PHASE 1 and are now re-runnable mid-project. Brainstorm ranks techniques toward gaps relative to built state; critique treats built components as facts and uses pitfall learnings to target weakness categories; seed's Edit/New routes load memory (Step 1d) and the Sync route gains built-component gap rows (`Source: Architecture`) + architectural learnings context.
- `project-backlog` v1.7.0: update/reconcile mode — new `references/update-reconcile.md` diffs the updated seed + new `.project/thinking/*.md` files (H1 + first section only) against the existing backlog, proposes NEW items and OBSOLETE candidates (TODO/DEFINED only), and cancels exclusively via an explicit cancel-proposal AskUserQuestion. INDEPENDENT items are only cancellable through per-item selection. Off-schema `DEPRECATED` status removed everywhere — canon is `CANCELLED` + `cancelledReason`.
- `project-todo` v1.1.0: records `backlog.json#seedDrift[]` entries (`scope-expansion`, `source: "/project-todo"`) when a new item is not represented in the seed — closes the drift gap vs `dev-define`/`game-define`/`project-backlog`. Seed file itself remains untouched (owned by `/project-seed`).
- `shared/SEED.md` + `shared/BACKLOG.md`: seedDrift `source` enum widened to include `/project-todo` and `/project-retire`; `BACKLOG.md` documents skill-driven cancellation and the optional `cancelledReason`/`cancelledAt` fields.

- `core-audit` v3.0.0: **BREAKING** rewrite — hypothetical walkthrough replaced by trace analysis of the real run (deviations, user corrections, "Other" answers, auto-decidable modals, unused loads → `references/trace-analysis.md`); mode is now auto-decided (trace vs static) instead of asked via modal; new pain-point question before analysis prioritizes user-reported friction; Step 1 loads the full skill surface (SKILL.md + `references/` + `techniques/`) instead of SKILL.md only; new deterministic Bash checks (description budget, reference integrity/orphans, `check-handoff.py`, dev/game counterpart flag); new Convention Compliance dimension scoring against `SKILL-PATTERNS.md` (lazy loading, task tracking, modal conventions, pipeline handoff); refactor flow uses numbered selective approval before single-shot plan mode and bumps the audited skill's version on apply (`references/refactor-plan.md`). SKILL.md 308 → 136 lines via lazy loading on itself.
- **BREAKING**: Renamed `dev-owasp` → `dev-security` (v2.1.0). The name describes the goal instead of the methodology — the skill already covers more than OWASP Top 10 (supply-chain/SAST tooling, now also secret scanning). `/dev-owasp` no longer resolves; use `/dev-security`. Scanner agents (`owasp-a01..a10-scanner`) and fix agents (`owasp-fix-*`) keep their names. Output dir `.project/owasp/` → `.project/security/`. References updated in `shared/PIPELINE.md`, `shared/DEVINFO.md`, `shared/PROJECT-MODE.md`, `shared/SKILL-PATTERNS.md`, `dev-refactor`. Also fixed: TaskCreate phase count (5 → 6 items) and a duplicated "Step 1: Present options" block with broken code fences in PHASE 5.
- `dev-security` v2.1.0 tooling sharpened: **gitleaks** added as third PHASE 2b scanner (secret detection in working tree + git history → A04, CRITICAL on active credentials, rotation-first fix guidance); Semgrep invocation corrected from `semgrep ci` (CI/platform mode) to `semgrep scan --config auto --json --quiet` (local mode); `npm audit --json --omit=dev` is now the explicit degraded fallback when osv-scanner is missing on npm projects. New scan-scope option "Changed features only" — audits only pipeline files of DONE/shipped backlog features for fast targeted runs between full scans.
- `dev-refactor` v2.7.0: conditional **Security lens** — fourth lens that only spawns when a feature touches security-relevant surface (routes/endpoints, auth/session/crypto, user-input parsing/upload, exec/file-ops on dynamic input, config/secrets; in doubt → include). Deep scan list in `references/lens-prompts.md § SECURITY` (authz gaps, secrets, input-flow tracing, weak crypto, SSRF, data exposure). The Quality lens keeps its basic SECURITY block as a baseline for every feature; merge-dedup on `file:line + fix` absorbs overlap. PHASE 1 renamed "Parallel Three-Lens Analysis" → "Parallel Lens Analysis"; LENS enum gains `security`; concurrency budget documents `lens_count ∈ {1, 3, 4}`. Plan footer suggests `/dev-security` when the Security lens yields ≥2 `HIGH|SEC` findings.
- `game-refactor` v1.5.1: security sync with dev-refactor — `analysis-prompt.md` SECURITY section gains hardcoded secrets in scripts/exported scene properties and unvalidated multiplayer RPC input (`@rpc("any_peer")` without checks). No structural lens change — game-refactor's single-agent model already scans security per feature.
- **BREAKING**: Renamed `concept` → `seed` throughout the dashboard, `project.json` schema, and all skill references. `project.json#concept` → `#seed`, `backlog.html#data.flags.hasConcept/conceptPath` → `hasSeed/seedPath`, `.project/project-concept.md` → `project-seed.md`. All skill references updated (`core-setup`, `shared/SEED.md`, `shared/SYNC.md`, `project-seed`, `project-brainstorm`, `project-critique`, `project-backlog`, `dev-define`, `game-define`, `project-todo`). Migration script: `scripts/migrate-concept-to-seed.cjs` (idempotent). Rationale: align data-field naming with the `/project-seed` skill.
- `frontend-tokens` v4.0.0: **BREAKING** — merged `frontend-animations` into `frontend-tokens`. Motion Pack routes (pick pack, customize, preview, apply, view, delete) now live under `/frontend-tokens → Motion Pack`. All animation references moved to `skills/frontend-tokens/references/motion/`. `frontend-animations` skill removed. Auto-trigger via `THEME/defining` backlog transition now also covers motion pack setup. PHASE 0 expanded with pack-rename check, MIGRATE_OFFER, and stack detection. No delta-write boundary between skills anymore — `frontend-tokens` owns the full `theme` object. All cross-references updated.

### Added

- `shared/CONVENTIONS.md`: new canonical protocol for per-project code conventions in `.project/conventions.md` — file format with `conventions-status` marker (`set`/`none`), three-state lifecycle (absent = never asked, `none` = explicit persistent opt-out, `set` = loaded), discovery sources (lint configs, CONTRIBUTING.md, styleguides), elicitation protocol (full in core-setup, lightweight fallback in dev-refactor), and load rules (agent-dispatching skills pass the path; main-context skills Read the file). Precedence: global MUST_DO > conventions.md > global SHOULD_DO. New `conventions` namespace in `shared/DEVINFO.md`.
- `core-setup`: new conventions elicitation phase — mature PHASE 4.6 (discovery scan → distill → confirm + one anchored open question per QUESTIONING.md) and greenfield Phase 7d (single question: none / paste guide / mini-interview), both via new `references/phase-conventions.md` with skip-guard on an existing file (the "none" choice is never re-asked).
- `dev-refactor` v2.6.0: conventions support — PHASE 0 step 6 status check + one-time lightweight fallback ask when absent; lens agents get a conditional "Read .project/conventions.md" line in the Universal Prompt Header; new `CONV` finding category (QUALITY lens only — other lenses use conventions for suppression). Lens review verdict: 3 lenses kept, no 4th conventions lens (concurrency budget + no independent scan strategy — header injection instead).
- `dev-build` v1.18.0 / `dev-verify` v2.12.0 / `game-build` v2.11.0 / `game-refactor` v1.5.0: read `.project/conventions.md` when status is `set` (build skills Read it in PHASE 0 and follow it during generation; verify/refactor pass the path to their Explore agents). No elicitation outside core-setup + dev-refactor.
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
