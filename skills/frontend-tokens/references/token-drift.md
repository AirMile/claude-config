# Token Drift Check (shared helper)

Use before every Write on `theme.colors`, `theme.typography`, or `theme.spacing` where an **existing key** gets a different value (not purely additive).

**Additive = no drift-risk** (no check needed):

- Adding a new key to `colors` (e.g. `colors.brand-accent`)
- Adding a new size to `typography.sizes`

**Drift-risk = existing key changes** (run drift check):

- `colors.primary` value changes or is removed/renamed
- `typography.fontFamily` changes
- `spacing` scale changes significantly

**Drift-check steps:**

1. Read `.project/backlog.json` → filter on `type === "PAGE" && (status === "DOING" || status === "DONE")`
2. If no affected pages → skip (no prompt)
3. With ≥1 affected page: show:

```
TOKEN DRIFT WARNING

Change:    {token-path}  {old value} → {new value}
Affected:  {N} pages in DOING/DONE state
Pages:     {page-name-1}, {page-name-2}, ...

These pages were built with the old token value. Changing it may
break their visual design.
```

**AskUserQuestion:**

```yaml
header: "Token Drift"
question: "Changing a token used in built pages. What do you want to do?"
options:
  - label: "Change anyway (Recommended)", description: "Update token — re-check pages later via /frontend-check"
  - label: "Update pages first", description: "Stop — update impacted pages before changing token"
  - label: "Cancel", description: "Abandon the token change"
multiSelect: false
```

**On "Change anyway":** write the change, set `tokenDrift: true` in devinfo, list affected pages in `devinfo.tokenDrift.affectedFeatures`.

**On "Update pages first"** or **"Cancel"**: stop without Write.
