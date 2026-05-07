# Audit Mode

Scan het project en stel verbeteringen voor zonder volledige setup. Non-destructief: geen bestanden worden gewijzigd zonder expliciete opt-in.

**Skip Phase 2-4, ga direct naar audit.**

---

## FASE 1: Project Scan

1. Scan voor ontbrekende essentials:
   - Formatter config (`.prettierrc`, `pyproject.toml [tool.black]`, etc.)
   - `.env.example`
   - `.gitignore`
   - Type checking config (`tsconfig.json`, `mypy.ini`, etc.)
   - Testing framework (`jest.config`, `vitest.config`, `pytest.ini`, etc.)

2. Check Claude config:
   - `.claude/settings.local.json` aanwezig?
   - `format-on-save` hook geconfigureerd?
   - Permissions ingesteld?

3. Check CLAUDE.md:
   - Bestaat?
   - Heeft canonical sections? (zie `references/claude-md-sections.md`)
   - Is `### Stack` up-to-date met werkelijke `package.json` / project files?

4. Check `.project/project.json`:
   - Bestaat?
   - `stack` sectie gevuld?
   - `concept` aanwezig?

5. Check design tokens (frontend projects only):
   - Detect `stack.framework` uit `.project/project.json`, of als dat ontbreekt, uit `package.json` dependencies
   - Frontend trigger: framework ∈ {React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS}
   - `needsTheme` = `project.json#theme.colors` ontbreekt of is leeg
   - Onthoud bevinding als `frontend_needs_theme` (alleen true als beide condities gelden)

6. Tier-1 module sweep:
   Voor elke module in de tier-1 set (zie `references/mode-install.md` tier-1 tabel):
   - Read `references/modules/{module}/setup-guide.md` Detection sectie
   - Pas de beschreven check toe op het project (package.json + configfiles)
   - Onthoud uitkomst: `already-installed-configured` | `installed-not-configured` | `not-installed`

   Cache resultaten als `module_states` voor FASE 2. Sla `not-installed` modules niet op als bevinding (alleen de twee geïnstalleerde states zijn relevant voor audit).

---

## FASE 2: Presenteer Bevindingen

Presenteer bevindingen als checklist via AskUserQuestion (multi-select): welke fixes toepassen?

Format per bevinding:

```
[ ] ✗ {missing item} — {korte reden waarom het nuttig is}
```

Default: alle kritieke items aangevinkt (formatter, .gitignore, type checking). Optionele items (testing framework) default uitgevinkt.

Design-tokens item alleen tonen als `frontend_needs_theme = true` (uit FASE 1 stap 5). Tonen als optioneel item, default uitgevinkt:

```
[ ] ✗ design-tokens — frontend stack zonder color/typography/spacing tokens
```

Module sweep bevindingen uit FASE 1 stap 6 (alleen tonen als `module_states` niet leeg is):

```
[ ] ⚠ {module} — installed-not-configured ({configfile} ontbreekt)
[ ] ℹ {module} — already-installed-configured (geen actie nodig)
```

`installed-not-configured` items default aangevinkt — deze zijn high-signal (library aanwezig, config ontbreekt of kapot). `already-installed-configured` items default uitgevinkt en alleen ter info.

---

## FASE 3: Voer Geselecteerde Fixes Uit

Voor elke geselecteerde fix:

- **Tier-1 module (installed-not-configured)**: delegeer naar `references/mode-install.md` FASE 5 voor die specifieke module. Stap 0 detecteert `installed-not-configured` → skipt install, begint bij stap 2 Configure.
- **Formatter config**: genereer config file op basis van gedetecteerde stack
- **.env.example**: genereer leeg sjabloon met comment per sectie
- **.gitignore**: genereer op basis van stack (Node/Python/Go/Rust/etc.)
- **Type checking**: genereer `tsconfig.json` / `mypy.ini` met strict-mode defaults
- **Testing framework**: vraag keuze (Vitest/Jest/Playwright voor JS, pytest voor Python, etc.), genereer config
- **Claude config**: schrijf `settings.local.json` met Full Access defaults + format-on-save hook voor gedetecteerde stack
- **CLAUDE.md**: voeg ontbrekende canonical sections toe (zie `references/claude-md-sections.md`). Bestaande content ongewijzigd.
- **project.json**: maak aan of vul ontbrekende `concept`/`stack` velden in via korte prompt (naam, beschrijving)
- **design-tokens**: seed `setup-design-tokens` feature naar `.project/backlog.html`:
  ```json
  {
    "name": "setup-design-tokens",
    "type": "THEME",
    "status": "TODO",
    "phase": "P1",
    "description": "Define color palette, typography scale, and spacing tokens via /frontend-tokens before UI work begins.",
    "source": "/core-setup",
    "dependencies": [],
    "auto": true
  }
  ```
  Maak backlog aan uit template `{skills_path}/shared/references/backlog-template.html` als die ontbreekt. Skip als feature met naam `setup-design-tokens` al bestaat (idempotent).

---

## FASE 4: Summary

Render-regel: bullets met `{if <conditie>}` prefix alleen tonen als conditie true is — prefix niet letterlijk in output. `design-tokens-applied` is true als user `design-tokens` heeft aangevinkt in FASE 2 én FASE 3 succesvol is uitgevoerd.

```
AUDIT COMPLETE

Fixes toegepast:
  {N} bestanden aangemaakt/bijgewerkt

Overgeslagen:
  {M} items (niet geselecteerd)

Volgende stap:
  /core-setup                 → diepe codebase scan + learnings extractie
  /core-setup --mode=resync   → CLAUDE.md template-secties hersyncen
{if design-tokens-applied}  /frontend-tokens            → design tokens (color, typography, spacing)
```
