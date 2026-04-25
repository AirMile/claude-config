---
name: core-changelog
description: Generate a user-facing changelog from git commit history. Use with /core-changelog. Parses conventional commits, filters noise, translates technical messages into customer-friendly language.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Changelog

Genereer een user-facing changelog uit git history. Filtert ruis (chore/refactor/test/docs), categoriseert, en vertaalt technische commit messages naar gebruikers-taal.

## Trigger

```
/core-changelog [--from <ref>] [--to HEAD] [--format markdown|json] [--style <path>]
```

**Argumenten:**

- `--from <ref>` — start van range. Default: laatste git tag, of bij geen tags `HEAD~20`
- `--to <ref>` — eind van range. Default: `HEAD`
- `--format` — `markdown` (default) of `json`
- `--style <path>` — optioneel pad naar style guide (bijv. `CHANGELOG_STYLE.md`) voor toon en format-conventies

## Process

### 1. Pre-flight Checks

Voer parallel uit:

- `git rev-parse --is-inside-work-tree` — verifieer dat we in een git repo zitten
- `git tag --sort=-creatordate | head -n 1` — laatste tag (voor default `--from`)
- `git log -1 --format=%H` — verifieer dat er commits zijn

**Stop condities** (meld en exit):

- Geen git repo → "Niet in een git repository"
- Geen commits → "Repository heeft nog geen commits"
- `--from` ref bestaat niet → "Ref `<from>` niet gevonden. Probeer `git tag` of een specifieke commit hash."

**Platform notitie:**
Gebruik `cd "<project-root>" && git <command>` ipv `git -C <path>` (Windows backslash issues).

**CHANGELOG.md detectie:**

- Lees `CHANGELOG.md` als die bestaat — gebruik bestaande structuur (Keep a Changelog, custom format)
- Als afwezig: nieuwe file met header `# Changelog`

**Style guide loading:**
Als `--style <path>` is opgegeven of `CHANGELOG_STYLE.md` aanwezig in repo root: lees in en gebruik als toon-/format-richtlijn.

### 2. Determine Range

**Resolve `--from`:**

1. Als arg gegeven: gebruik direct
2. Anders: laatste tag (`git describe --tags --abbrev=0`)
3. Geen tags? Vraag via AskUserQuestion:
   - header: "Range"
   - question: "Geen tags gevonden. Welke range gebruiken?"
   - options:
     - "Laatste 20 commits (Recommended)" → `HEAD~20`
     - "Laatste 7 dagen" → `--since="7 days ago"`
     - "Laatste 30 dagen" → `--since="30 days ago"`
     - "Specificeer handmatig" → vraag ref input

**Resolve `--to`:** default `HEAD`.

**Toon range-info:**

```
Range: <from>..<to>
Aantal commits: N
```

### 3. Gather Commits

```bash
git log <from>..<to> --pretty=format:'%H%x09%s%x09%b%x1e' --no-merges
```

(`%x09` = tab, `%x1e` = record separator). Parse naar list van `{hash, subject, body}`.

**Validatie:**

- Filter merge commits (al gedaan via `--no-merges`)
- Skip commits met empty subject

### 4. Categorize & Filter

**Conventional Commit parsing:**
Match `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?(!)?:\s+(.+)$`

| Type           | Categorie       | Toon       |
| -------------- | --------------- | ---------- |
| `feat`         | ✨ Features     | toon       |
| `fix`          | 🐛 Fixes        | toon       |
| `perf`         | ⚡ Improvements | toon       |
| `revert`       | ↩️ Reverts      | toon       |
| `BREAKING` (!) | 💥 Breaking     | toon (top) |
| `docs`         | —               | skip       |
| `style`        | —               | skip       |
| `refactor`     | —               | skip       |
| `test`         | —               | skip       |
| `build`        | —               | skip       |
| `ci`           | —               | skip       |
| `chore`        | —               | skip       |

**Breaking change detectie:**

- `!` na type/scope → BREAKING (header in output)
- Body bevat `BREAKING CHANGE:` → BREAKING + extract footer text als toelichting

**Non-conventional commits:**
Als een commit niet matcht (bijv. "WIP fix login"): probeer keyword detection (`fix`/`bug` → fixes; `add`/`new` → features). Als onduidelijk → groepeer onder "Other Changes" (toonbaar) of skip op vraag.

**Per categorie sorteer:**
Behoud chronologische volgorde (oudste eerst), zodat changelog leest als verhaal.

### 5. Translate to User-Friendly

Voor elke getoonde commit: schrijf de subject om naar gebruikers-taal.

**Vertaal-regels:**

| Patroon                | Voorbeeld                              | Wordt                                              |
| ---------------------- | -------------------------------------- | -------------------------------------------------- |
| Technical jargon       | "fix: null check in auth middleware"   | "Resolved sign-in issue affecting some users"      |
| Implementation detail  | "feat: add JWT refresh token rotation" | "Sessions stay signed in longer and more securely" |
| Internal noun          | "feat(api): add /v2/users endpoint"    | "New API endpoint for user data (v2)"              |
| Reference internal IDs | "fix: handle ABC-123 edge case"        | strip ID, beschrijf user-impact                    |

**Schrijfstijl:**

- Imperative → declarative ("Add" → "Added" of beschrijf het effect)
- Begin met user-zichtbare actie/effect, niet met de code-wijziging
- Strip verwijzingen naar interne PR/issue nummers tenzij relevant
- Combineer gerelateerde commits ("fix: null check" + "fix: error message" → één entry over auth fixes)

**Behoud technische precisie waar relevant:**

- Breaking changes: noem wat verandert + migratie-pad als bekend
- Security fixes: noem CVE/severity zonder details die exploitatie helpen

**Style guide override:**
Als `--style` is geladen, volg die conventies (bijv. emoji-gebruik, person, tijd).

### 6. Render

**Markdown format (default):**

```markdown
## [<version>] - <YYYY-MM-DD>

### 💥 Breaking Changes

- <description>
  <migration note indien aanwezig>

### ✨ New Features

- <description>

### ⚡ Improvements

- <description>

### 🐛 Bug Fixes

- <description>
```

**Version detectie:**

- Als `--from` een tag is in semver-vorm: increment naar volgende minor (`v1.2.3` → suggest `v1.3.0`)
- Bij breaking changes: suggest major bump
- Vraag user voor confirm via AskUserQuestion

**JSON format (`--format json`):**

```json
{
  "version": "1.3.0",
  "date": "2026-04-25",
  "range": { "from": "v1.2.3", "to": "HEAD" },
  "categories": {
    "breaking": [{ "title": "...", "migration": "..." }],
    "features": [{ "title": "..." }],
    "improvements": [{ "title": "..." }],
    "fixes": [{ "title": "..." }]
  }
}
```

**Lege categorieën:** weglaten (geen lege headers).

### 7. Confirm & Write

Toon preview van rendered output en vraag via AskUserQuestion:

- header: "Changelog"
- question: "Genereerde changelog:\n\n<preview>\n\nWaar opslaan?"
- options:
  - "Prepend aan CHANGELOG.md (Recommended)" → voeg bovenaan toe (na `# Changelog` header)
  - "Stdout only" → toon, schrijf niets
  - "Append aan CHANGELOG.md" → voeg onderaan toe
  - "Aanpassen" → laat user editen, toon opnieuw

**Schrijven naar CHANGELOG.md:**

1. Lees bestaande inhoud
2. Detecteer header (`# Changelog` of equivalent)
3. Voeg nieuwe versie-blok toe direct na header (prepend) of aan eind (append)
4. Schrijf bestand
5. **Stage NIET automatisch** — laat user zelf committen via `/core-commit`

### 8. Error Handling

**Geen commits in range:**

```
ℹ️ Geen commits tussen <from> en <to>. Niets om te genereren.
```

**Alleen geskipte commits (alle chore/refactor/etc):**

```
ℹ️ <N> commits gevonden, allemaal interne wijzigingen (chore/refactor/test/docs).
   Geen user-facing changelog nodig.
```

Vraag toch wel: "Toch genereren?" via AskUserQuestion (default: nee).

**Mixed conventional + non-conventional:**
Toon waarschuwing met aantal niet-geclassificeerde commits, vraag of ze in "Other Changes" sectie moeten of geskipt.

**CHANGELOG.md write failure:**

- Permission denied → toon pad, suggereer chmod
- File locked → wacht of skip naar stdout

## Output

**Succes (Markdown naar CHANGELOG.md):**

```
✅ Changelog gegenereerd: <version>

   <N> commits → <M> entries
   📝 Opgeslagen in CHANGELOG.md (prepended)

   Volgende stap: review en commit via /core-commit
```

**Succes (stdout only):**

```
✅ Changelog gegenereerd

   <N> commits → <M> entries
   (niet opgeslagen — copy from output above)
```

**Error:**

```
❌ Changelog generatie mislukt: <reden>

   💡 <suggestie>
```

## Voorbeelden

### Voorbeeld 1: Sinds laatste tag

```
/core-changelog
```

Detecteert laatste tag `v1.2.3`, range = `v1.2.3..HEAD`, genereert markdown, prepend aan CHANGELOG.md.

### Voorbeeld 2: Specifieke range

```
/core-changelog --from v1.0.0 --to v2.0.0
```

Genereert changelog voor major release.

### Voorbeeld 3: JSON voor automatisering

```
/core-changelog --from HEAD~50 --format json
```

JSON output → kan in CI gebruikt worden voor release-notes generatie.

### Voorbeeld 4: Met custom style

```
/core-changelog --style docs/CHANGELOG_STYLE.md
```

Volgt project-specifieke toon en format-regels.
