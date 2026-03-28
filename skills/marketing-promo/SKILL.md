---
name: marketing-promo
argument-hint: "[url]"
description: >-
  Generate marketing-quality screenshots of a web app via MCP Playwright tools.
  Use with /frontend-screenshots [url] for Product Hunt, social media, landing
  pages, or documentation. Analyzes codebase to discover routes and features.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: marketing
---

# Screenshots

Generate marketing-quality screenshots of a web app using MCP Playwright tools. Analyzes the codebase to discover routes and features, plans screenshots with the user, and captures them at HiDPI resolution.

**Trigger**: `/frontend-screenshots` or `/frontend-screenshots [url]`

## FASE 0: Determine App URL

**If `$1` provided** → use as the app URL.

**If no URL provided:**

1. Check for running dev server:

   ```bash
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
   ```

   If found, verify:

   ```bash
   curl -s -o /dev/null -w "%{http_code}" {tunnel_url}
   ```

   If HTTP 200 → use this URL.

2. Check localhost:

   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null
   ```

3. If nothing found → use **AskUserQuestion**:
   - header: "App URL"
   - question: "Geen draaiende server gevonden. Wat is de URL van de app?"
   - options:
     - label: "localhost:3000", description: "Next.js, Create React App, Rails"
     - label: "localhost:5173", description: "Vite"
     - label: "localhost:4000", description: "Phoenix"
     - label: "localhost:8080", description: "Vue CLI, generic"
   - multiSelect: false

4. Verify the URL is reachable via `browser_navigate`. If it fails → exit with message to start the dev server first (e.g. `/dev-server`).

## FASE 1: Gather Requirements

Use **AskUserQuestion** for each:

**Question 1: Count**

- header: "Aantal"
- question: "Hoeveel screenshots heb je nodig?"
- options:
  - label: "3-5 (Recommended)", description: "Snelle set van de belangrijkste features"
  - label: "5-10", description: "Uitgebreide feature coverage"
  - label: "10+", description: "Volledige marketing suite"
- multiSelect: false

**Question 2: Purpose**

- header: "Doel"
- question: "Waar worden de screenshots voor gebruikt?"
- options:
  - label: "Product Hunt", description: "Hero shots en feature highlights"
  - label: "Social media", description: "Opvallende feature demos"
  - label: "Landing page", description: "Marketing secties en benefits"
  - label: "Documentatie", description: "UI referentie en tutorials"
- multiSelect: false

**Question 3: Authentication**

- header: "Auth"
- question: "Vereist de app login om bij de features te komen?"
- options:
  - label: "Geen login nodig (Recommended)", description: "Alleen publieke pagina's"
  - label: "Ja, ik geef credentials", description: "Moet eerst inloggen"
- multiSelect: false

If "Ja, ik geef credentials" → follow-up **AskUserQuestion**:

- header: "Login Details"
- question: "Wat zijn de login gegevens? (login URL, email, wachtwoord)"
- options:
  - label: "Ik typ ze hieronder", description: "Geef credentials als vrije tekst"

**Question 4: Dark Mode**

- header: "Dark Mode"
- question: "Wil je ook dark mode varianten?"
- options:
  - label: "Nee (Recommended)", description: "Alleen light mode"
  - label: "Ja, beide thema's", description: "Light + dark variant per screenshot"
- multiSelect: false

## FASE 2: Analyze Codebase for Features

Discover routes and screenshottable features inline using Glob, Grep, and Read.

1. Read README.md (and any docs/) for feature descriptions and app purpose
2. Find routing configuration:
   - Next.js App Router: app/ directory (folders with page.tsx)
   - Next.js Pages Router: pages/ directory
   - React Router: search for createBrowserRouter or <Route
   - Vue Router: src/router/index.js
   - Rails: config/routes.rb
   - Other: search for route definitions
3. Identify key UI components:
   - Dashboards, data tables, charts/graphs
   - Forms, settings panels, user profiles
   - Modals, dialogs, sidebars
   - Landing/marketing pages
   - Pricing tables, feature lists
4. Check for theme support (dark mode toggle, colorScheme)

Return structured output:
FEATURES_START
| # | Feature | URL Path | Description | Required State |
|---|---------|----------|-------------|----------------|
| 1 | {name} | {path} | {what it shows} | {logged in / public / modal open / etc.} |
FEATURES_END

APP_DESCRIPTION: {1-2 sentence summary of what the app does}
THEME_SUPPORT: {yes/no}

```

Parse the structured output from the agent.

## FASE 3: Plan Screenshots with User

Display discovered features:

```

FEATURES GEVONDEN: {app description}

| #   | Feature | URL | Beschrijving | Status |
| --- | ------- | --- | ------------ | ------ |

{features table from agent}

Voorgestelde screenshots: {count based on FASE 1 selection}

```

Use **AskUserQuestion**:

- header: "Feature Selectie"
- question: "Welke features wil je screenshotten? (nummers)"
- options:
  - label: "Alle bovenstaande (Recommended)", description: "Screenshots van alle gevonden features"
  - label: "Ik kies specifieke", description: "Ik geef aan welke nummers"
- multiSelect: false

If "Ik kies specifieke" → ask for numbers.

After selection, assign numbered filenames:

```

SCREENSHOT PLAN:

| #   | Bestand               | Feature   | URL   |
| --- | --------------------- | --------- | ----- |
| 1   | 01-{feature-slug}.png | {feature} | {url} |
| 2   | 02-{feature-slug}.png | {feature} | {url} |

...

````

Create output directory:

```bash
mkdir -p .project/screenshots
````

## FASE 4: Capture Screenshots

### Primary Method: HiDPI via browser_run_code

Use `browser_run_code` to create a dedicated browser context with `deviceScaleFactor: 2` for true retina-quality screenshots (2880x1800px output from 1440x900 viewport).

**Template per screenshot:**

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();

  // AUTH_BLOCK (only if auth needed, only for first screenshot)
  // await p.goto('{login_url}');
  // await p.locator('input[type="email"], input[name="email"]').first().fill('{email}');
  // await p.locator('input[type="password"]').first().fill('{password}');
  // await p.locator('button[type="submit"]').first().click();
  // await p.waitForLoadState('networkidle');

  await p.goto("{url}");
  await p.waitForLoadState("networkidle");

  // ACTIONS_BLOCK (if needed: click tabs, open modals, scroll)
  // await p.click('{selector}');
  // await p.waitForTimeout(500);

  await p.screenshot({
    path: ".project/screenshots/{filename}",
    fullPage: false,
  });

  await ctx.close();
  return "Captured: {filename}";
};
```

**For dark mode variants** (if requested):

After capturing the light mode screenshot, re-run with dark color scheme:

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  // ... same navigation + screenshot with '-dark' suffix
};
```

### Fallback Method: Standard MCP Tools

If `browser_run_code` fails (e.g., `browser()` returns null in connected mode):

1. `browser_resize` to width: 1440, height: 900
2. `browser_navigate` to URL
3. `browser_wait_for` with appropriate text or time
4. `browser_take_screenshot` with filename

Note: fallback produces viewport-resolution screenshots (1440x900), not HiDPI.

### Execution Flow

For each planned screenshot:

1. Log: `Capturing {n}/{total}: {feature name}...`
2. Handle auth on first page if needed (login flow)
3. Navigate to target URL
4. Wait for content to load (networkidle)
5. Execute pre-screenshot actions if needed (open modal, select tab, scroll)
6. Capture screenshot
7. If dark mode requested → capture dark variant
8. Log: `Saved: {filename}`

### Auth Handling

If credentials were provided in FASE 1:

- Login on the FIRST screenshot only
- Use cookie persistence within the browser context for subsequent pages
- Smart login: try common form patterns:
  - Email: `input[type="email"]`, `input[name="email"]`, `input[id="email"]`
  - Password: `input[type="password"]`
  - Submit: `button[type="submit"]`, `button:has-text("Sign in")`, `button:has-text("Log in")`

## FASE 5: Verify and Summarize

1. List generated files:

   ```bash
   ls -la .project/screenshots/*.png 2>/dev/null
   ```

2. Get dimensions:

   ```bash
   file .project/screenshots/*.png
   ```

3. Display summary:

   ```
   SCREENSHOTS COMPLETE

   | # | Bestand | Feature | Dimensies |
   |---|---------|---------|-----------|
   | 1 | 01-dashboard-overview.png | Dashboard | 2880x1800 |
   | 2 | 02-settings-panel.png | Settings | 2880x1800 |
   ...

   Totaal: {n} screenshots in .project/screenshots/
   Kwaliteit: {HiDPI 2x retina | Standaard viewport}
   Doel: {purpose from FASE 1}
   ```

4. If purpose is "Product Hunt" → mention recommended image sizes (1270x760)
5. If purpose is "Social media" → suggest cropping for platform-specific ratios

## Error Handling

### App not reachable

**Cause:** Dev server not running.
**Solution:** Start with `/dev-server` or provide a live URL. The skill does not start servers itself.

### Login failed

**Cause:** Smart login patterns don't match the app's login form.
**Solution:** Use `browser_snapshot` to inspect the login page, then manually identify selectors. Retry with correct selectors via `browser_run_code`.

### browser_run_code fails

**Cause:** MCP Playwright may not expose `browser()` in all connection modes.
**Solution:** Automatic fallback to standard MCP tools (browser_resize + browser_take_screenshot). Screenshots will be viewport resolution instead of HiDPI.

### Screenshot is blank or incomplete

**Cause:** Page not fully loaded before screenshot.
**Solution:** Increase wait time. Use `browser_wait_for` with specific text that indicates the page is ready, or add `page.waitForTimeout(2000)` before capture.

## Restrictions

This skill must NEVER:

- Install npm packages or dependencies
- Start dev servers (use `/dev-server` for that)
- Store credentials in files
- Overwrite existing screenshots without user confirmation
- Take screenshots without user-approved plan

This skill must ALWAYS:

- Verify the app URL is reachable before starting
- Present the screenshot plan for user approval
- Try HiDPI (2x retina) via browser_run_code first
- Fall back gracefully to standard tools if HiDPI fails
- Report actual dimensions in the summary
- Clean up browser contexts after use
