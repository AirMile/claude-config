# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

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

- `.claude/CLAUDE.md`: Platform table genericized — hardcoded machine-specific paths replaced with "configurable via env var or `paths.local.yaml`"
- `local/CLAUDE.md.base`: translated to English; `Language: English` default
- `local/settings.json.template`: safe defaults — `defaultMode: default`, `voiceEnabled: false`; removed `skipDangerousModePermissionPrompt`
- All skill/agent frontmatters: `author: mileszeilstra` → `author: claude-config`
- `README.md`: added Prerequisites, Install, Personal overlay sections; updated License
- `local/README.md`: translated to English; replaced hardcoded `C:\Projects\claude-config` with `<your-clone-path>`
- `agents/godot-tdd-implementer.md`: Godot exe path via `${CLAUDE_GODOT_EXECUTABLE}` env var with fallback
- `skills/core-rewrite/SKILL.md`: style option descriptions translated to English

### Removed

- `skills/shared/styles/style-portfolio.md`, `style-personal.md`, `style-clear.md`, `_anti-patterns.md` — personal styles; use `personal/styles/` instead
- "Personal configuration — not intended for distribution" disclaimer from README
