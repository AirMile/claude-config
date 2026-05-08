---
name: core-setup
description: >-
  Project setup hub — auto-detects whether a project is greenfield or mature
  and routes to the matching flow. Greenfield: interactive wizard (stack,
  CLAUDE.md, dashboard init). Mature: full codebase scan + LLM learnings +
  CLAUDE.md sync. Also Audit, Resync, and Install modes. Install mode:
  incrementally add tools/libraries via `/core-setup [module]` (tailwind,
  playwright, vitest, shadcn-ui, biome, zustand, etc.). Use with /core-setup.
argument-hint: "[--mode=greenfield|mature|audit|resync|install] [module] [--no-llm]"
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: core
---

# Project Setup Skill

**Trigger**: `/core-setup [--mode=greenfield|mature|audit|resync|install] [module] [--no-llm]`

Hub skill die detecteert wat het project nodig heeft en de juiste flow laadt.

### "Let Claude decide" Option

For every AskUserQuestion where the choice involves **technical decisions** (not personal preferences), add a final option:

- **Label**: "Let Claude decide"
- **Description**: "Claude picks the best option based on your project context and best practices"

**Exclude from**: language selection, project description, project name, project type, commit.

**Include in**: all other modals (tech stack, suggestions, web standards, git init, permissions, exclusions).

**When selected**: kies de beste optie op basis van project context en best practices. Toon:

```
CLAUDE'S PICK: {chosen option} — {brief reason}
```

### Modal Option Cap

Voor dynamic multi-select modals (Audit fixes, Resync drift, Tech stack, Suggestions, Documentation Generators): pas `shared/SKILL-PATTERNS.md` § Modal Option Cap toe. Modals met ≤7 opties zijn vrijgesteld.

---

## Phase 0: Detect Mode

1. **Module arg check** — als `$1` aanwezig is en géén `--mode=` prefix heeft: match (case-insensitive) tegen tier-1 modules:
   `inspect-overlay`, `tailwind`, `shadcn-ui`, `vitest`, `playwright`, `biome`, `eslint-prettier`, `zustand`, `tanstack-query`, `react-hook-form-zod`
   - **Match** → laad `references/mode-install.md` met `direct_module=$1`. Skip stap 2-4.
   - **Geen match** → sla `$1` op als `direct_research`, laad `references/mode-install.md` met research-pad. Skip stap 2-4.

2. **Check `--mode` flag** — als meegegeven, sla stap 3 over en laad direct de bijbehorende reference:
   - `--mode=greenfield` → `references/mode-greenfield.md`
   - `--mode=mature` → `references/mode-mature.md` (geef `--no-llm` flag door indien aanwezig)
   - `--mode=audit` → `references/mode-audit.md`
   - `--mode=resync` → `references/mode-resync.md`
   - `--mode=install` → `references/mode-install.md`

3. **Detect bestaand project** — run detectie:

   ```bash
   python3 .claude/skills/core-setup/scripts/detect-existing.py --path .
   python3 .claude/skills/core-setup/scripts/detect-mode.py --path .
   ```

   Gebruik `detect-mode.py` output als primaire classificatie. `detect-existing.py` controleert aanwezigheid van bestaande config files.

4. **Kies mode** op basis van resultaten:

   | detect-mode output | Bestaande configs? | Actie                                                             | User-facing one-liner                             |
   | ------------------ | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------- |
   | `greenfield`       | nee                | Laad `mode-greenfield.md` direct                                  | `Nieuw project — start setup wizard.`             |
   | `greenfield`       | ja                 | AskUserQuestion: Greenfield wizard / Mature scan / Audit / Resync | `Bestaand project gedetecteerd — kies hieronder.` |
   | `mature`           | n.v.t.             | Laad `mode-mature.md` direct                                      | `Bestaand project — scan codebase.`               |
   | `ambiguous`        | n.v.t.             | AskUserQuestion: Greenfield wizard / Mature scan / Audit          | `Project state onduidelijk — kies hieronder.`     |

   **Rapportage-regel:** toon alleen de one-liner uit de tabel hierboven aan de user. Geen filenames (`mode-greenfield.md`), geen script-output, geen interne classificatie-termen. Detectie-details horen in een eventuele debug-mode, niet in de happy path.

   **AskUserQuestion bij ambiguous / bestaande configs** (single-select):
   - **Greenfield wizard** — "Nieuw project, ik wil stack en standards instellen" → `mode-greenfield.md`
   - **Mature scan (Recommended bij bestaand project)** — "Bestaand project, scan de codebase en bouw base memory op (incl. Module Gap-modal voor lege tier-1 slots)" → `mode-mature.md`
   - **Audit** — "Check wat er mist, geen volledige setup" → `mode-audit.md`
   - **Resync** _(alleen bij `greenfield + bestaande configs`, niet bij `ambiguous`)_ — "Alleen CLAUDE.md template-secties updaten" → `mode-resync.md`

5. **Laad de gekozen reference.**
