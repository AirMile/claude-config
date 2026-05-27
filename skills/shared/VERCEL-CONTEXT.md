# Shared: Vercel Web Interface Guidelines

Fetch and cache the Vercel Labs web interface guidelines for use as a code-gen bias layer in Build and Convert routes.

**Cache path:** `.project/cache/vercel-web-interface-guidelines.md`
**TTL:** 7 days

---

## Load Protocol

1. Check `.project/cache/vercel-web-interface-guidelines.md` exists **AND** its mtime is less than 7 days old.
   - **Cache hit** → Read file into working memory. Set `$VERCEL_CONTEXT = true`. Done.

2. **Cache miss or stale** → WebFetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.
   - **Fetch success** → Write response to `.project/cache/vercel-web-interface-guidelines.md` (create `.project/cache/` if needed). Read into working memory. Set `$VERCEL_CONTEXT = true`.
   - **Fetch fail** → check if a stale cache file exists.
     - Stale file present → Read it. Print `⚠ Vercel guidelines: fetch failed — using stale cache`. Set `$VERCEL_CONTEXT = true`.
     - No file at all → Print `⚠ Vercel guidelines unavailable — continuing with DESIGN.md only`. Set `$VERCEL_CONTEXT = false`.

---

## Usage as Bias Layer

Apply the loaded guidelines when generating JSX/CSS. Concretely:

- **Typography** → `tabular-nums` on numeric UI, `text-wrap: balance` on headlines, curly quotes (`'…'`/`"…"`) in visible copy, Title Case for headings
- **Motion** → never emit `transition: all`; animate only `transform`/`opacity`; always pair with `@media (prefers-reduced-motion: reduce)`
- **Interactions** → `focus-visible:ring-*` pattern (not `focus:ring-*`); icon-only buttons include `aria-label`
- **Content** → ellipsis character `…` (not `...`), `Intl.DateTimeFormat` / `Intl.NumberFormat` for locale-sensitive output
- **Dark mode** → `color-scheme: dark` on `.dark` root when dark tokens are present

**Conflict rule**: `skills/shared/DESIGN.md` is the project canon. If Vercel's guidelines conflict with DESIGN.md, DESIGN.md wins.

**Traceability** (on success, i.e. `$VERCEL_CONTEXT = true`): record in `project.json → thinking.setupContext[]`:

```json
{
  "source": "vercel-labs/web-interface-guidelines",
  "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
  "role": "code-quality bias layer",
  "cached": true
}
```
