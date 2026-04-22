# claude-config

Persoonlijke Claude Code configuratie: skills, agents, hooks en scripts. Gekoppeld aan `~/.claude/` via junctions (Windows) of symlinks (macOS) zodat alles globaal beschikbaar is.

**Paden zijn identiek** — `~/.claude/skills/` en de repo's `skills/` wijzen naar dezelfde bestanden. Commits altijd in deze repo.

## Platform

Cross-platform: **Windows (primair)** en **macOS (optioneel)**.

|               | Windows                                  | macOS                          |
| ------------- | ---------------------------------------- | ------------------------------ |
| Repo          | `C:\Projects\claude-config`              | `$HOME/projects/claude-config` |
| Projects root | `C:\Projects`                            | `$HOME/projects`               |
| Koppeling     | `mklink /J` (junction)                   | `ln -sfn` (symlink)            |
| Godot         | `/c/Godot/Godot_v4.4.1-stable_win64.exe` | n.v.t.                         |
| Shell         | PowerShell                               | bash/zsh                       |

**Regels:**

- Gebruik `{projects_root}` in skills, niet hardcoded paden
- `paths.yaml` bevat per-platform defaults (override via env vars of `paths.local.yaml`)
- Git op Windows: vermijd `git -C <path>` met backslashes → `cd "<path>" && git <cmd>`
- Platform-specifieke commands altijd voor beide OS'en documenteren

## Structuur

```
skills/           55+ skills in 8 categorieën
  shared/         RULES.md, PATTERNS.md, PLAYWRIGHT.md, VALIDATION.md, DEVINFO.md
  {cat}-{verb}/   Skill directories (elk met SKILL.md)
agents/           20 sub-agent definities (.md met YAML frontmatter)
hooks/            format-on-save.cjs, prompt-timer.cjs
local/            Portable configs voor ~/.claude/ (templates, niet gejunctiond)
CLAUDE.base.md    Template voor per-project CLAUDE.md generatie
```

## Skill Conventies

- **Naamgeving**: `{category}-{verb}` — lowercase, hyphen. Categorieën: core, dev, frontend, game, marketing, project, story, team, thinking
- **Directory**: elke skill = map met `SKILL.md`, optioneel `references/`, `scripts/`, `techniques/`
- **Frontmatter**: altijd `disable-model-invocation: true`, metadata met author/version/category
- **Taal**: instructies Nederlands, technische termen Engels
- **Fases**: FASE 0 = pre-flight validatie → uitvoering → laatste fase = rapport (ASCII tabel)
- **AskUserQuestion**: eerste optie = recommended, multiSelect default true
- **Shared infra** (`skills/shared/*`): read-only single source of truth — refereer, niet dupliceren

## Agent Conventies

- Frontmatter: name, description, model (`sonnet` default), color
- Draaien via `Task` tool in geïsoleerde context — output compact houden
- Alleen gebruiken waar agents échte waarde toevoegen: schaal-parallelisme (OWASP scanners), onafhankelijk denken (fix strategies), context-isolatie bij grote hoeveelheden (refactor Explore)
- Meeste skills doen analyse inline — agents alleen voor de uitzonderingen hierboven

## Pipelines

**Frontend**: plan, theme, compose/convert, iterate, audit/wcag — standalone skills, vrij combineerbaar. Elke skill detecteert beschikbare context (theme, code, design spec) en past zich aan.
**Dev**: define → plan → build → test → debug → refactor
**Game**: define → plan → build → test → debug → refactor (Godot 4.x, GDScript, GUT)

State handoff tussen skills via `.project/session/devinfo.json` (schema: `shared/DEVINFO.md`).

## Belangrijke Patronen

- **`.project/`**: alle runtime artifacts (gitignored) — wireframes, config, session, screenshots
- **`.project/project.json`**: centraal project dashboard met context (structuur, routing, patterns), features, stack, endpoints, entities, thinking. Schema: `shared/DASHBOARD.md`. Per-project CLAUDE.md verwijst hiernaar voor runtime context.
- **Profiles**: `core-profile/profiles.yaml` + `switch-profile.py` togglet skill visibility per profiel
- **Format-on-save**: hook runt Prettier (web) of gdformat (GDScript) na elke Write/Edit
- **Backlog**: `.project/backlog.html` met status TODO → DOING (stages: defining/defined/building/built/testing) → DONE
- **Build skills**: auto-commit, auto-sync `project.json` context na voltooiing

## Regels bij Wijzigingen

- Volg bestaande conventies — check een vergelijkbare skill voordat je een nieuwe maakt
- Shared bestanden niet aanpassen zonder impact op alle skills te overwegen
- Nieuwe skills: kopieer frontmatter structuur van bestaande skill in dezelfde categorie
- Test door de skill daadwerkelijk te runnen
- Dev/game pipeline sync: bij structurele wijzigingen aan dev-pipeline skills (dev-define, dev-build, dev-verify, dev-debug, dev-refactor), check of de game-pipeline counterpart (game-\*) dezelfde wijziging nodig heeft. Domein-specifieke content (Godot vs web, GUT vs browser) hoeft niet gesyncroniseerd.
