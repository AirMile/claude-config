# Apply & Sync — PHASE 5

Loaded at the start of PHASE 5. Inputs: `$TARGETS`, `$COPY_MAP`, `$I18N_MODE`, `$I18N_FILE`,
`$GLOSSARY_UPDATES`, `$THEME`, `$BACKLOG_FOUND` (per target), `$MODE`.

---

## 5.1 Apply copy

**If `$I18N_MODE = false` (inline)**

For each entry in `$COPY_MAP` (grouped by file):

- Read the target file
- Replace `old` with `new` using Edit (exact string match)
- Multi-occurrence: if the same string appears more than once and the replacements should differ
  per occurrence (e.g. different aria-labels on similar buttons) → replace individually. If the
  same copy applies everywhere → `replace_all: true`.
- Format-on-save hook runs automatically after each Write/Edit — no manual format step needed.

**If `$I18N_MODE = true` (strings/i18n file)**

Two-step apply per entry:

1. **Add keys to `$I18N_FILE`**: derive key as `{target}.{category}.{element_hint}` in snake_case.
   Read `$I18N_FILE` → merge (never overwrite existing keys) → Write back.
2. **Replace hardcoded string in source file** with the i18n call: grep one existing call pattern
   (`t('…')` / `i18n.t(…)` / `$t(…)` / `useTranslation`) to detect the project convention, then
   replicate with the new key.

Print per file:

```
Apply:  [✓] {file} — {N} replacement(s)
```

---

## 5.2 Glossary write

If `$GLOSSARY_UPDATES` is non-empty:

Read `.project/project.json`. Navigate to `theme.voice.terms` (create path if absent).
Merge `$GLOSSARY_UPDATES` into `terms` — never overwrite existing entries.
Write back.

Print:

```
Glossary: [✓] {K} new term(s) persisted to project.theme.voice.terms
```

If `$GLOSSARY_UPDATES` is empty → skip silently.

---

## 5.3 Spot-check

After all edits, re-read each modified file and verify:

- No `old` strings from `$COPY_MAP` remain (catch missed multi-line matches)
- No syntax breakage (unbalanced quotes, JSX attribute errors)

If a mismatch is found → attempt one correction Edit. If still broken → report:

```
Apply:  [!] {file} — manual check needed at {element}
```

and continue (non-blocking).

---

## 5.4 Backlog sync

Per target where `$BACKLOG_FOUND[target] = true`:

Follow `shared/BACKLOG.md → Lifecycle Protocol → Write`:

```
Re-read .project/backlog.json
Find feature where name === {target}
Set:    feature.contentStatus = "filled"
Remove: feature.transition       (clear the "contenting" marker)
Status: keep "DOING"             (frontend-check is the gate to DONE)
Set:    data.updated = today (ISO date)
Write back
```

For batch with N targets: batch the mutations — read once, apply all, write once.

Print per target:

```
Backlog: [✓] "{target}" — contentStatus: filled, transition cleared
```

If `$BACKLOG_FOUND[target] = false` → skip silently (standalone run).

---

## 5.5 Completion report

```
╔══════════════════════════════════════════════════════════╗
║  frontend-content complete                               ║
╠══════════════════════════════════════════════════════════╣
║  Target(s)   {names}  ({single | batch N})              ║
║  Files       {N} modified                               ║
║  Copy items  {total from $COPY_MAP}                     ║
║  Mode        {inline | i18n → $I18N_FILE}               ║
║  Glossary    {K} new terms | unchanged                  ║
║  Backlog     {N} transitioned | standalone              ║
╚══════════════════════════════════════════════════════════╝
```

**Next steps** (PAGE targets only — COMPONENT ships with its consuming PAGE):

```
Next:  /frontend-check {target(s)} — runtime audit, moves PAGE to DONE on PASS
       (or /frontend-check without arg to batch-audit all built pages)
```

For COMPONENT-only runs: omit Next line — frontend-check promotes the consuming PAGE, not the
component directly.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /frontend-check {target} → runtime audit before shipping.
