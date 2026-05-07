---
name: core-setup
description: >-
  Project setup hub — detecteert automatisch of het een greenfield of mature
  project is en kiest de juiste flow. Greenfield: interactieve wizard
  (stack, CLAUDE.md, dashboard init). Mature: volledige codebase scan + LLM
  learnings + CLAUDE.md sync. Ook Audit, Resync en Install modes. Install mode:
  incrementeel tools/libraries toevoegen via `/core-setup [module]` (tailwind,
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

**Exclude from**: language selection, project description, project name, project type.

**Include in**: all other modals (tech stack, suggestions, web standards, git init, permissions, exclusions, commit).

**When selected**: kies de beste optie op basis van project context en best practices. Toon:

```
CLAUDE'S PICK: {chosen option} — {brief reason}
```

### Modal Option Cap

Voor dynamic multi-select modals (Audit fixes, Resync drift, Tech stack, Suggestions, Documentation Generators): pas `shared/SKILL-PATTERNS.md` § Modal Option Cap toe. Modals met ≤7 opties zijn vrijgesteld.

---

## Phase 0: Detect Mode

0. **Module arg check** — als `$1` aanwezig is en géén `--mode=` prefix heeft: match (case-insensitive) tegen tier-1 modules:
   `inspect-overlay`, `tailwind`, `shadcn-ui`, `vitest`, `playwright`, `biome`, `eslint-prettier`, `zustand`, `tanstack-query`, `react-hook-form-zod`
   - **Match** → laad `references/mode-install.md` met `direct_module=$1`. Skip stap 1-3.
   - **Geen match** → sla `$1` op als `direct_research`, laad `references/mode-install.md` met research-pad. Skip stap 1-3.

1. **Check `--mode` flag** — als meegegeven, sla stap 2 over en laad direct de bijbehorende reference:
   - `--mode=greenfield` → `references/mode-greenfield.md`
   - `--mode=mature` → `references/mode-mature.md` (geef `--no-llm` flag door indien aanwezig)
   - `--mode=audit` → `references/mode-audit.md`
   - `--mode=resync` → `references/mode-resync.md`
   - `--mode=install` → `references/mode-install.md`

2. **Detect bestaand project** — run detectie:

   ```bash
   python3 .claude/skills/core-setup/scripts/detect-existing.py --path .
   python3 .claude/skills/core-setup/scripts/detect-mode.py --path .
   ```

   Gebruik `detect-mode.py` output als primaire classificatie. `detect-existing.py` controleert aanwezigheid van bestaande config files.

3. **Kies mode** op basis van resultaten:

   | detect-mode output | Bestaande configs? | Actie                                                             |
   | ------------------ | ------------------ | ----------------------------------------------------------------- |
   | `greenfield`       | nee                | Laad `mode-greenfield.md` direct                                  |
   | `greenfield`       | ja                 | AskUserQuestion: Greenfield wizard / Mature scan / Audit / Resync |
   | `mature`           | n.v.t.             | Laad `mode-mature.md` direct                                      |
   | `ambiguous`        | n.v.t.             | AskUserQuestion: Greenfield wizard / Mature scan / Audit          |

   **AskUserQuestion bij ambiguous / bestaande configs** (single-select):
   - **Greenfield wizard** — "Nieuw project, ik wil stack en standards instellen" → `mode-greenfield.md`
   - **Mature scan (Recommended bij bestaand project)** — "Bestaand project, scan de codebase en bouw base memory op" → `mode-mature.md`
   - **Audit** — "Check wat er mist, geen volledige setup" → `mode-audit.md`
   - **Resync** — "Alleen CLAUDE.md template-secties updaten" → `mode-resync.md`
   - **Tool toevoegen** — "Voeg een library of tool toe aan een bestaand project" → `mode-install.md`

4. **Laad de gekozen reference** en volg de instructies daarin volledig.

---

## Modes (referenced)

| Mode         | Reference                       | Wanneer                                                         |
| ------------ | ------------------------------- | --------------------------------------------------------------- |
| `greenfield` | `references/mode-greenfield.md` | Nieuw project zonder bestaande code                             |
| `mature`     | `references/mode-mature.md`     | Bestaand project joinen — scan + LLM learnings                  |
| `audit`      | `references/mode-audit.md`      | Checklist-scan, geen mutaties zonder opt-in                     |
| `resync`     | `references/mode-resync.md`     | Alleen CLAUDE.md template-secties hersyncen                     |
| `install`    | `references/mode-install.md`    | Incrementeel tools/libraries toevoegen — `/core-setup [module]` |

**`--no-llm`**: alleen van toepassing in mature mode — skip LLM extractie, alleen MVP signalen.
