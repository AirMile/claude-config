---
name: core-md-revise
description: >-
  Capture session learnings and update CLAUDE.md files. Reviews the current session
  for missing context, proposes concise additions, and applies after approval.
  Use with /core-md-revise at end of session or when user says "update CLAUDE.md
  with learnings", "revise project memory", or "capture session context".
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
disable-model-invocation: true
allowed-tools: Read, Edit, Glob
---

# CLAUDE.md Revise

Review de huidige sessie voor learnings en update CLAUDE.md met context die toekomstige Claude-sessies effectiever maakt.

## Trigger

`/core-md-revise` aan het einde van een sessie, of wanneer de gebruiker vraagt om learnings vast te leggen.

## Process

### 1. Reflect

Welke context ontbrak die Claude effectiever had laten werken?

- Bash commands die gebruikt of ontdekt zijn
- Code style patterns die gevolgd zijn
- Testing aanpakken die werkten
- Environment/configuratie-eigenaardigheden
- Waarschuwingen of gotchas die tegengekomen zijn

### 2. Find CLAUDE.md Files

```bash
find . -name "CLAUDE.md" -o -name ".claude.local.md" 2>/dev/null | head -20
```

Bepaal waar elke toevoeging hoort:

- `CLAUDE.md` — Team-gedeeld (ingecheckt in git)
- `.claude.local.md` — Persoonlijk/lokaal (gitignored)

### 3. Draft Additions

**Houd het beknopt** — een regel per concept. CLAUDE.md is onderdeel van de prompt, dus beknoptheid is belangrijk.

Formaat: `<command of pattern>` - `<korte beschrijving>`

**Vermijd:**

- Verbose uitleg
- Voor de hand liggende informatie
- Eenmalige fixes die waarschijnlijk niet terugkeren

### 4. Show Proposed Changes

Voor elke toevoeging:

```markdown
### Update: ./CLAUDE.md

**Waarom:** [een-regel reden]

\`\`\`diff

- [de toevoeging - houd het kort]
  \`\`\`
```

### 5. Apply with Approval

Vraag of de gebruiker de wijzigingen wil toepassen. Bewerk alleen bestanden die zij goedkeuren.

## Output

**Voorstel:**

```
## Sessie Learnings

### Voorgestelde updates
1. [bestand] — [wat + waarom]
2. [bestand] — [wat + waarom]

Wil je deze toepassen?
```

**Na toepassing:**

```
Toegepast: X updates op Y bestanden
```
