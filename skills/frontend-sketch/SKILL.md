---
name: frontend-sketch
description: Low-fi UI canvas for sketching screens — drag components, ask Claude to generate frames, promote to high-fi code. Use with /frontend-sketch.
argument-hint: '[<prompt> | new <slug> | generate <slug> "<prompt>" | promote <slug> [--frame <id>]]'
metadata:
  author: claude-config
  version: 1.0.0
  category: frontend
---

# Sketch

Low-fidelity UI sketching canvas powered by Excalidraw. Claude writes frames into
`.project/canvas/<slug>.excalidraw`; the browser polls and reloads live.

**Pipeline position:** Before `/frontend-design` — use to explore layout ideas, generate
multiple screen variants, then `promote` the winner to high-fi code via Convert route.

**Related skills:** `/frontend-design` · `/frontend-tokens` · `/project-viewer`

---

## PHASE 0: Pre-flight

Check prerequisites:

1. `.project/` exists in the current project directory — if not, ask the user to run
   `/core-setup` first.
2. `project-viewer` server is reachable (`curl -s http://localhost:9876/ > /dev/null 2>&1`)
   — if not, start it using the same logic as `/project-viewer` PHASE 1.
3. Canvas template exists at
   `~/.claude/skills/frontend-sketch/templates/canvas-template.html` — hard error if
   missing.

```
Pre-flight:
  .project/      [✓|✗]
  Server :9876   [✓ running | ✗ starting…]
  Template       [✓|✗]
```

---

## Router

Parse the first positional argument (or default to `generate` when a quoted prompt is the
only argument):

| Argument starts with | Route                               |
| -------------------- | ----------------------------------- |
| `new`                | `references/route-new.md`           |
| `generate`           | `references/route-generate.md`      |
| `promote`            | `references/route-promote.md`       |
| `open`               | **inline** (PHASE 2 → print URL)    |
| _(quoted string)_    | `references/route-generate.md`      |
| _(none)_             | `references/route-interactive.md` ⬅ |

Load the reference file for the chosen route:

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-new.md' (for `new`)
> **Todo**: Read '.claude/skills/frontend-sketch/references/route-generate.md' (for `generate`)
> **Todo**: Read '.claude/skills/frontend-sketch/references/route-promote.md' (for `promote`)
> **Todo**: Read '.claude/skills/frontend-sketch/references/route-interactive.md' (for no args)

---

## Open route (inline)

Extract `<slug>` from argument. Build URL:

```
http://localhost:9876/{project-dir}/canvas/<slug>
```

Where `{project-dir}` = `basename $PWD` (assumes cwd is the project root).

Print:

```
Canvas: http://localhost:9876/{project}/canvas/<slug>
```

Copy to clipboard:

```bash
printf '%s' "http://localhost:9876/{project}/canvas/{slug}" | pbcopy  # macOS
```

---

## Interactive hub (no argument)

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-interactive.md'

---

## PHASE 2: Report (all routes)

After the route completes, always print the report table:

```
╔══════════════════════════════════════════════════════════╗
║  frontend-sketch — {route}                               ║
╠════════════════════╤══════════╤════════╤════════════════╣
║  Canvas            │ Page ref │ Frames │ URL            ║
╠════════════════════╪══════════╪════════╪════════════════╣
║  {slug}            │ {page}   │ {n}    │ localhost:9876 ║
╚════════════════════╧══════════╧════════╧════════════════╝

Next:  /frontend-sketch generate {slug} "describe screens"
       /frontend-sketch promote {slug} --frame f1
       /frontend-design <screenshot-or-path>
```
