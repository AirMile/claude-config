# CLAUDE.md Sync Protocol

Shared logica voor CLAUDE.md updates. Gebruikt door `mode-resync` (volledige flow) en `mode-mature` FASE 5.5 (deelflow na project.json sync).

Zie `references/claude-md-sections.md` voor canonical section templates.

---

## Inputs (caller specificeert)

| Parameter             | Type                               | Beschrijving                                                |
| --------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `mode`                | `"resync"` \| `"mature"`           | Bepaalt rapport-output en generate-gedrag                   |
| `generate-if-missing` | `bool`                             | `true` → genereer compleet als CLAUDE.md ontbreekt (mature) |
| `stack-overwrite`     | `"always"` \| `"ask"` \| `"never"` | Bepaalt hoe `### Stack` behandeld wordt                     |
| `inferred-stack`      | object \| null                     | Stack afgeleid uit FASE 2 (alleen mature, anders `null`)    |

---

## FASE A: Detect

1. Controleer of `CLAUDE.md` bestaat.
   - Ontbreekt + `generate-if-missing=false` → exit met error: `CLAUDE.md niet gevonden — voer /core-setup --mode=greenfield uit of maak handmatig aan.`
   - Ontbreekt + `generate-if-missing=true` → ga direct naar **Genereer compleet** (skip FASE B).

2. Lees `CLAUDE.md` en de root `CLAUDE.base.md` (gebruikt voor canonical marker-templates).

3. Parse alle sectie-blokken gemarkeerd door:

   ```
   <!-- claude-config:section:<id> start -->
   ...
   <!-- claude-config:section:<id> end -->
   ```

4. Classificeer per sectie:

   | Status         | Definitie                                                               |
   | -------------- | ----------------------------------------------------------------------- |
   | **Missing**    | Marker bestaat in base, niet in project → kandidaat om toe te voegen    |
   | **Drift**      | Marker bestaat in beide maar inhoud verschilt → kandidaat om te updaten |
   | **Match**      | Identiek → skip                                                         |
   | **Local-only** | Marker in project niet in base → laat staan, project-customization      |

5. **`### Stack` apart behandelen** (alleen als `inferred-stack` aanwezig):
   - Vergelijk `### Stack` sectie in CLAUDE.md met `inferred-stack` waarden.
   - Classificeer als Stack-drift als ze afwijken.

**Buiten markers**: alle inhoud zonder marker (User Preferences, Project, Project Context, custom edits) blijft **ongewijzigd**.

---

## Genereer compleet (als CLAUDE.md ontbreekt en generate-if-missing=true)

Genereer volledig nieuw `CLAUDE.md` met:

- Alle canonical sections uit `references/claude-md-sections.md`
- `inferred-stack` invullen in `### Stack` template (als aanwezig)
- `## Project Context` met verwijzing naar `.project/project.json` en `.project/project-context.json`

Schrijf direct — geen modal nodig. Ga naar FASE D.

---

## FASE B: Strategy

Als er geen missing én geen drift secties zijn → sla FASE B en C over, ga naar FASE D met bericht "al compleet".

AskUserQuestion (multi-select) met de drift/missing secties als opties:

- **Default checked**: alleen missing secties (veilig — voegt toe, overschrijft niets)
- **Default unchecked**: alle drift secties (vereist expliciete opt-in — drift kan bewuste user-edit zijn)
- Per drift-sectie: toon inline diff (project ↔ base)
- **Stack-drift item** (alleen als `stack-overwrite="ask"` en Stack-drift aanwezig):
  - Aparte checkbox: `### Stack — update naar werkelijke stack`
  - Inline diff: CLAUDE.md huidige stack ↔ `inferred-stack`
  - Default unchecked

Bij `stack-overwrite="always"`: vervang `### Stack` zonder modal, vóór FASE B.

---

## FASE C: Apply

Schrijf alleen geselecteerde wijzigingen. Placeholder-substituties (`{{PROJECT_NAME}}` etc.) zitten buiten markers en blijven onaangeroerd.

Per gekozen sectie: vervang inhoud tussen markers met base-versie. Stack-overwrite: vervang `### Stack` blok met `inferred-stack` waarden.

---

## FASE D: Rapport

**Resync mode** — standalone ASCII tabel:

```
| Sectie | Actie                                     | Bron-versie   |
| ------ | ----------------------------------------- | ------------- |
| {id}   | added / updated / kept-local / skipped    | {base versie} |
```

**Mature mode** — compact samengevat als één regel in FASE 6 rapport:

```
CLAUDE.md: {gegenereerd | {N} secties toegevoegd | al compleet}
```
