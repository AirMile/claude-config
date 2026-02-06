# Playwright Browser Automation

Reusable Playwright MCP patterns for visual validation, accessibility checks, and browser-based testing across frontend skills.

---

## Overview

| Tool | Purpose | Returns |
|------|---------|---------|
| `browser_navigate` | Open URL in browser | Page loaded state |
| `browser_wait_for` | Wait for content/time | Sync point |
| `browser_snapshot` | Capture accessibility tree | **Tree structure (direct)** |
| `browser_take_screenshot` | Capture visual state | **Image data (direct)** |
| `browser_close` | Clean up browser session | - |

> **Ephemeral Pattern**: All Playwright tools return data directly to the agent. Analyze in conversation - no file storage needed.

---

## Standard Execution Pattern

### Basic Analysis Sequence

For static page validation:

```
PLAYWRIGHT SEQUENCE
───────────────────
1. browser_navigate → [url]
2. browser_snapshot → (analyze accessibility tree)
3. browser_take_screenshot → (view visual state)
4. browser_close
```

### Dynamic Content Sequence

For client-rendered content (SPA, React, Vue):

```
PLAYWRIGHT SEQUENCE (Dynamic)
─────────────────────────────
1. browser_navigate → [url]
2. browser_wait_for → { text: "[expected content]" }
3. browser_snapshot → (analyze accessibility tree)
4. browser_take_screenshot → (view visual state)
5. browser_close
```

### Timed Wait Sequence

For animations or transitions:

```
PLAYWRIGHT SEQUENCE (Timed)
───────────────────────────
1. browser_navigate → [url]
2. browser_wait_for → { time: 2 }
3. browser_take_screenshot → (view visual state)
4. browser_close
```

---

## Pre-flight Validation

Before any Playwright operations, verify availability:

```
PRE-FLIGHT: Playwright
──────────────────────
[ ] Playwright MCP tools available
    → browser_navigate: [✓|✗]
    → browser_snapshot: [✓|✗]
    → browser_take_screenshot: [✓|✗]
    → browser_close: [✓|✗]
[ ] URL accessible (file:// or http://)
```

### Availability Check

```
Playwright: [✓ Available | ✗ Unavailable]
  Tools: [4/4 | N/4] available
  Status: [Ready | Degraded | Unavailable]
```

### On Unavailable

```yaml
header: "Playwright Unavailable"
question: "Playwright tools niet beschikbaar. Hoe doorgaan?"
options:
  - label: "Doorgaan zonder visuals (Recommended)"
    description: "Skip browser checks, continue workflow"
  - label: "Installeer browser"
    description: "Run: browser_install"
  - label: "Annuleren"
    description: "Stop workflow"
```

---

## Error Recovery

### Navigation Failures

| Error | Cause | Recovery |
|-------|-------|----------|
| URL not found | Invalid path | Use absolute path with `file:///` prefix |
| Timeout | Page doesn't load | Increase wait time, retry once |
| Protocol error | Wrong URL scheme | Ensure `file://` for local, `http://` for server |
| Connection refused | Server not running | Start dev server, retry |

### Graceful Degradation

```
PLAYWRIGHT DEGRADATION
──────────────────────
Level 1: Full analysis (screenshot + snapshot) ← Default
Level 2: Snapshot only (skip screenshot)
Level 3: Skip browser validation entirely
Level 4: Manual browser open instruction
```

**Degradation Flow:**

```
Full Analysis
    ↓ (screenshot fails)
Snapshot Only
    ↓ (snapshot fails)
Skip Browser Validation (warn user)
    ↓ (tools unavailable)
Manual Instructions:
  "Open [url] in browser to verify manually"
```

---

## Use Cases by Skill

### Wireframe: Visual Design Validation

```
Purpose: Analyze wireframe designs for reflection
Data needed: Accessibility tree for structure analysis
Sequence: navigate → snapshot → screenshot → close
Agent analyzes: Layout, headings, interactive elements
```

### SEO: Rendered Content Validation (S003)

```
Purpose: Verify client-rendered content is visible to crawlers
Data needed: Accessibility tree to detect rendered content
Sequence: navigate → wait_for (content) → snapshot → close
Agent checks: Title, H1, meta tags in accessibility tree
Critical: Detects SPA content invisible to search engines
```

### Validate: Browser-Based Accessibility

```
Purpose: Check accessibility rules requiring DOM inspection
Data needed: Accessibility tree for element analysis
Sequence: navigate → snapshot → close
Agent checks: H1 count (H002), interactive elements (H006)
```

---

## Integration Examples

### Example: Local HTML File

```
FILE ANALYSIS
─────────────
URL: file:///C:/Projects/app/output/wireframe.html

1. browser_navigate → file:///[absolute-path]/wireframe.html
2. browser_snapshot → (parse accessibility tree for structure)
3. browser_take_screenshot → (view visual result)
4. browser_close

Agent analyzes snapshot for:
- Heading hierarchy
- Interactive elements
- Content structure
```

### Example: Development Server (SPA)

```
DEV SERVER ANALYSIS
───────────────────
URL: http://localhost:3000/dashboard

1. browser_navigate → http://localhost:3000/dashboard
2. browser_wait_for → { text: "Dashboard" }
3. browser_snapshot → (verify content rendered)
4. browser_close

Agent checks:
- Content visible in accessibility tree (not just source)
- H1 present after hydration
- Meta tags rendered (if dynamic)
```

### Example: Accessibility Snapshot Analysis

```
ACCESSIBILITY ANALYSIS
──────────────────────
1. browser_navigate → [url]
2. browser_snapshot → (returns accessibility tree)

Agent parses returned snapshot for:
- heading: H1 count (H002 rule)
- button: Interactive element count
- link: Navigation elements
- textbox: Form fields

Example snapshot content:
  - heading "Dashboard Overview" [level=1]
  - navigation "Main Nav"
    - link "Home"
    - link "Settings"
  - button "Create New"
  - textbox "Search"
```

---

## Best Practices

### URL Handling

- **Local files**: Always use absolute paths with `file:///` prefix
- **Windows paths**: Convert backslashes: `C:\path` → `file:///C:/path`
- **Dev servers**: Verify server running before analysis
- **Storybook**: Use iframe URL for cleaner analysis

### Wait Strategies

| Content Type | Wait Strategy |
|--------------|---------------|
| Static HTML | No wait needed |
| SSR/SSG | Short wait (500ms) |
| Client-rendered | Wait for text/element |
| Animations | Timed wait (1-2s) |
| Heavy content | Wait for specific text |

### Resource Cleanup

- **Always** call `browser_close` after analysis
- **Handle errors** with try/finally pattern
- **Don't leave** browser sessions hanging
- **Check** for orphan processes if issues occur

---

## Cross-Skill References

| Skill | Uses Playwright For | Primary Data |
|-------|---------------------|--------------|
| `frontend-wireframe` | Design analysis, reflection | Accessibility tree |
| `frontend-seo` | Rendered content validation (S003) | Accessibility tree |
| `frontend-validate` | Browser-based accessibility checks | Accessibility tree |
