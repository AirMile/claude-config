# Route: Colour-landscape research (optional)

Spawns background research to ground the palette in _what's already taken_ before generating
colours. Off by default — never blocks the direct Create path. Invoked from `route-create.md`
Step 1 (Colours) when the user opts in, or standalone via the action menu.

## When it runs

At Step 1, before generating a palette:

**AskUserQuestion:**

```yaml
header: "Research"
question: "Research the brand/colour landscape first? (spawns a background workflow)"
options:
  - label: "No — generate directly (Recommended)", description: "Skip research; Claude picks colours from the project description"
  - label: "Yes — research competitors & free lanes", description: "Fan out research on competitor brand colours, crowded vs open hue lanes, and accessibility caveats"
multiSelect: false
```

On **No** → return to Step 1 and generate normally.
On **Yes** → run the workflow below, then continue Step 1 with `$LANDSCAPE` active.

## Spawn (Workflow — preferred)

Mirrors the `dev-ship` spawn contract (`Workflow({scriptPath, args})` + schema-validated result;
prompts/inputs passed via `args`, not giant inline strings).

> **Todo**: gather 3–6 competitor/peer product names for context (from `project.json` seed/stack, or
> ask the user one line: "Which products should I compare against?"). Then launch:
> `Workflow({scriptPath: ".claude/skills/design-tokens/references/workflows/token-research.js", args: {domain: "<what you're building>", competitors: [<names>], constraintHue: "<optional: e.g. 'green spectrum only'>"}})`
> The script fans out three read-only research agents (competitor brand colours · hue-occupancy /
> free lanes · accessibility caveats) and returns one **landscape** object (schema below).

**Agent-tool fallback** (Workflow unavailable, or a spurious empty-input failure): spawn **one**
`subagent_type: "general-purpose"`, `model: "sonnet"` research agent with the same brief — "audit
competitor brand colours, map crowded vs open hue lanes, flag accessibility caveats; return the
landscape JSON" — and use its result.

## Landscape schema (what the workflow returns)

```json
{
  "pins": [{ "name": "Netlify", "hsl": 174 }],
  "lanes": [
    [161, 172, "free"],
    [315, 335, "free"]
  ],
  "candidates": [
    {
      "id": "teal",
      "name": "Teal",
      "hex": "#20BDA8",
      "hsl": 172,
      "lane": "free",
      "note": "…"
    }
  ],
  "caveats": ["lime/chartreuse (~80-105°) fails small-text contrast on white"]
}
```

## Feeding the result

Set `$LANDSCAPE` = the returned object and continue Step 1:

- The palette suggestion prefers a `candidate` in a `"free"` lane and respects any `constraintHue`.
- The **token explorer** (`references/token-explorer.html` § `color` tab, wired at Step 1) is
  populated directly from `$LANDSCAPE.pins` / `.lanes` / `.candidates` — so the user compares real
  candidates against the real occupancy map, in dark & light.
- Surface `caveats` as a one-line note under the palette (e.g. contrast warnings).

`$LANDSCAPE` is advisory: the user still picks the accent at the explorer/Step 1 confirmation.
