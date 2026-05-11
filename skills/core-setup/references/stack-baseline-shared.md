# Stack Baseline Research

Gedeelde procedure voor het genereren van `.claude/research/stack-baseline.md`. Gebruikt door `mode-greenfield.md` Phase 7 en `mode-mature.md` FASE 5.85.

---

## Doel

Genereer `.claude/research/stack-baseline.md` — herbruikbare framework-conventies die duplicate Context7 queries in andere skills voorkomen. Een joiner (of greenfield-setup) hoeft daarna niet opnieuw dezelfde tech-docs op te zoeken.

## Trigger-conditie

Alleen uitvoeren wanneer:

- `stack.framework` gevuld is (minimaal één major technologie bekend)
- `.claude/research/stack-baseline.md` nog **niet** bestaat (idempotent — herstart-veilig)

## Uitvoering

**Run as general-purpose agent** (`subagent_type="general-purpose"`) voor context-isolatie — Context7 queries voor meerdere stack-technologieën produceren substantiële output die niet in de main session hoort. De agent heeft Write access nodig; Explore is read-only en werkt niet.

1. Maak eerst de map aan: `mkdir -p .claude/research`
2. Bepaal de major technologieën uit `stack.framework`, `stack.language`, `stack.styling`, `stack.db`, `stack.auth` (skip lege velden)
3. Voor elke technologie, query Context7 (`resolve-library-id` → `query-docs`)
4. Distilleer per technologie:
   - **Conventions** (5-10): naamgeving, structuur, configuratie-patronen
   - **Patterns** (5-10): veelgebruikte oplossingen, idioms
   - **Testing** (3-5): test-setup, mocking-conventies, assertions
   - **Pitfalls** (3-5): bekende valkuilen, versie-specifieke bugs, migratie-issues
5. Schrijf het resultaat direct naar `.claude/research/stack-baseline.md`
6. Voeg een Context7 library IDs tabel onderaan toe voor follow-up queries

**Game projects (Godot):** genereer ook `.claude/research/architecture-baseline.md` met scene tree patterns, node types, signals, state machines.

## Output formaat

```markdown
# Stack Baseline

Gegenereerd door /core-setup op {datum}. Herbruikbaar in alle skills — niet handmatig editen.

## {Framework/Library naam}

### Conventions

- ...

### Patterns

- ...

### Testing

- ...

### Pitfalls

- ...

---

## Context7 Library IDs

| Technologie | Library ID |
| ----------- | ---------- |
| {naam}      | {id}       |
```
