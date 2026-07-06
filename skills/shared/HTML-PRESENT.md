# HTML Present Helper

Open a visual artifact in the user's **default browser**, automatically. Used by skills that
produce something visual — a token gallery, a wireframe, a freshly-built page — so the user
sees it without copy-pasting a path.

**Target** is either:

- a **`file://` path** to a self-contained HTML file the skill just generated (no server), or
- an **`http://` URL** to an already-running dev server (e.g. design-convert's smoke target).

The open command is identical for both.

---

## When

A skill reaches a completion/report point AND has a visual artifact to show:

- **design-tokens** → token-pack gallery + motion preview (always — a theme is always visual).
- **dev-ship / game-ship** → adaptive feature-spec preview after PHASE 0 define, but **only when the
  feature has visual UI to show** (a `design`/wireframe or `sceneLayout`) — a pure-logic/API feature
  renders no preview. It is a **visual aid** on top of the PHASE 0 plan-approval gate (Step 4b), not a
  replacement: the gate is the review surface.
- **design-convert** → the live dev-server URL (only when the smoke check actually rendered).

The textual report stays — this is the interactive layer on top, exactly like
`NEXT-STEP-OFFER.md` sits on top of the `Next steps:` block.

## Opt-out

If the env var `CLAUDE_AUTO_PREVIEW` is set to `0` or `false`, do **not** open anything —
just print the target so the user can open it by hand. (Naming matches the existing
`CLAUDE_*` env vars in `paths.yaml`.) Anything else (unset / `1` / `true`) → auto-open.

## Output location (file:// case only)

Generated HTML goes to `.project/previews/{skill}-{slug}.html` — a stable folder next to
`.project/screenshots/`. `.project/` is fully gitignored, so nothing is committed. Create the
folder if missing. The `http://` case generates no file.

## Self-contained HTML requirement (file:// case)

Templates served via `file://` MUST be self-contained: inline CSS, inline render JS, no
external assets or CDN `<script src>`. The skill fills a single
`<script id="preview-data" type="application/json">…</script>` block — the inline render JS
reads it and builds the DOM. (Same injection point as `references/lib/templates.js`, but the
rendering happens in-page rather than on a server.)

---

## Open command (cross-platform)

Detect platform like `CLIPBOARD.md` (`$OSTYPE` / `uname -s` / the bootstrap platform marker),
then run the matching command via the Bash tool. `$TARGET` is the `file://` path or `http://`
URL. **Never let a launch failure crash the skill** — fall back to printing the target.

**macOS / Linux** (Bash):

```bash
if [ "$CLAUDE_AUTO_PREVIEW" = "0" ] || [ "$CLAUDE_AUTO_PREVIEW" = "false" ]; then
  printf 'Preview klaar — open handmatig: %s\n' "$TARGET"
else
  ( open "$TARGET" 2>/dev/null || xdg-open "$TARGET" 2>/dev/null ) \
    && printf 'Preview geopend in browser (%s)\n' "$TARGET" \
    || printf 'Preview klaar — open handmatig: %s\n' "$TARGET"
fi
```

(`open` = macOS, `xdg-open` = Linux; the `||` chain picks whichever exists.)

**Windows** (Bash tool with PowerShell):

```bash
powershell -NoProfile -Command "if ('$env:CLAUDE_AUTO_PREVIEW' -eq '0' -or '$env:CLAUDE_AUTO_PREVIEW' -eq 'false') { Write-Output 'Preview klaar — open handmatig: $TARGET' } else { try { Start-Process '$TARGET'; Write-Output 'Preview geopend in browser ($TARGET)' } catch { Write-Output 'Preview klaar — open handmatig: $TARGET' } }"
```

## Confirmation output

Exactly one line (runtime language from `CLAUDE.md § User Preferences → Language:`, NL default):

- Opened: `Preview geopend in browser ({target})`
- Opt-out or launch failure: `Preview klaar — open handmatig: {target}`

Do not echo the HTML or the page contents back into the chat.

---

## Transition marker (for lazy-loading in skill files)

Place at the skill's completion/report point, after the textual report:

```
> **Todo**: present {target} in the browser — read
> '.claude/skills/shared/HTML-PRESENT.md'. ({target} = a file:// path or an http:// URL)
```

For the **file://** case the marker also names the template + data to render first:

```
> **Todo**: render `{template}` to `.project/previews/{skill}-{slug}.html` (fill the
> `preview-data` JSON block with {data}), then present that file:// path via
> '.claude/skills/shared/HTML-PRESENT.md'.
```

## Rules

- **One open per completion** — never open multiple tabs in a single run.
- **Conditional skills stay conditional** — design-convert only presents when its
  visual artifact actually exists (smoke rendered); dev-ship/game-ship's define-phase preview (see
  above) only renders when the feature has visual UI (a `design`/wireframe or `sceneLayout`).
  No artifact → no preview, no error.
- **Never block on it** — a failed launch is a printed path, never a halt.
- **Resolve `{slug}`** from the artifact's name (feature/theme/page), kebab-cased.
- The marker does NOT replace the textual report — it runs after it.
