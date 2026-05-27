# PHASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "frontend-design",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]"
    }
  }
}
```

**Handoff cleanup** (if session started via PHASE 0.2 build-incomplete handoff): set `devinfo.handoff = null`.

**TokenDrift cleanup** (if page scope): read `devinfo.tokenDrift.affectedFeatures` → remove the current page name if present → if list is empty: `tokenDrift.resolved = true`. Write back.

### 4.2 Backlog Completion Sync (page scope only)

If page scope and backlog exists:

1. Read `.project/backlog.html` → parse JSON
2. Find feature matching page name → set `stage: "built"`, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)

### 4.3 Gap-Discovery

Trigger C — scan all generated/updated component files for stub handlers. Follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery). **Source:** `"/frontend-design"` · **Direction:** `"frontend→dev"` · **Type:** `FEATURE`. If no gaps: skip this step.

### 4.4 Completion Report

```
CONVERT COMPLETE
═══════════════════════════════════════════════════════════

Source:       [file path | URL | pasted image]
Mode:         [1:1 copy | Inspiration | Sketch → high-fi]
Framework:    [detected framework]
Verification: [N] rounds, [High | Medium | Low] match
Code quality: [PASS | [N] violations fixed]
Gaps:         [N linked | M created | K pending | "none"]

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

═══════════════════════════════════════════════════════════
```

Ask after report:

```yaml
header: "Continue with audit?"
question: "/frontend-check {page-name} checks A11Y, tokens, and responsive behavior."
options:
  - label: "Yes, audit now (Recommended)", description: "Run frontend-check inline"
  - label: "Later", description: "Status stays DOING — /frontend-check {page-name} ready in the backlog"
multiSelect: false
```

On "Yes": read `frontend-check/SKILL.md` and run PHASE 0–4 inline for `{page-name}`.
On "Later": end — backlog shows DOING status with next step `/frontend-check {page-name}`.
