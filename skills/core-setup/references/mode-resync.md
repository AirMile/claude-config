# Resync Mode

Synchroniseer alleen CLAUDE.md template-secties met de meest recente `CLAUDE.base.md`. Bestaande project-specifieke content blijft ongewijzigd.

---

## Pre-flight

Controleer dat `CLAUDE.md` bestaat in de project root. Ontbreekt het → exit met instructie: gebruik `/core-setup` om het project eerst in te richten.

---

## Sync

Volg `references/claude-md-sync.md` met deze parameters:

- `mode: "resync"`
- `generate-if-missing: false`
- `stack-overwrite: "never"`
- `inferred-stack: null`

FASE D produceert een standalone ASCII rapport — dat is het eindresultaat van deze skill.
