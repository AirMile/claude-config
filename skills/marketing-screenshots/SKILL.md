---
name: marketing-screenshots
argument-hint: "[url]"
description: Generate marketing screenshots and GIF demos. Use with /marketing-screenshots.
metadata:
  author: claude-config
  version: 1.0.0
  category: marketing
---

# Screenshots

Generate marketing-quality screenshots of a web app using Playwright CLI, plus optional GIF demos via Claude-in-Chrome. Analyzes the codebase to discover routes and features, plans screenshots with the user, and captures them at HiDPI resolution.

HiDPI 2x screenshots stay on Playwright CLI (`deviceScaleFactor: 2`) — Claude-in-Chrome's `computer` screenshots are bound to physical display DPI and can't produce true retina output. GIF demos have no Playwright equivalent and use Claude-in-Chrome's `gif_creator` — see `../shared/CLAUDE-IN-CHROME.md`.

**Trigger**: `/marketing-screenshots` or `/marketing-screenshots [url]`

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and `completed` at the end. If context compaction occurs, the task list stays visible — no risk of forgotten phases.

1. PHASE 0: Determine App URL
2. PHASE 1: Gather Requirements
3. PHASE 2: Analyze Codebase for Features
4. PHASE 3: Plan Screenshots with User
5. PHASE 4: Capture Screenshots
6. PHASE 5: Verify and Summarize

## PHASE 0: Determine App URL

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

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
   - question: "No running server found. What is the URL of the app?"
   - options:
     - label: "localhost:3000", description: "Next.js, Create React App, Rails"
     - label: "localhost:5173", description: "Vite"
     - label: "localhost:4000", description: "Phoenix"
     - label: "localhost:8080", description: "Vue CLI, generic"
   - multiSelect: false

4. Verify the URL is reachable via `playwright-cli open [url]`. If it fails → exit with message to start the dev server first (e.g. `/project-tunnel`).

## PHASE 1: Gather Requirements

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

Use **AskUserQuestion** for each:

**Question 1: Count**

- header: "Count"
- question: "How many screenshots do you need?"
- options:
  - label: "3-5 (Recommended)", description: "Quick set of the most important features"
  - label: "5-10", description: "Extensive feature coverage"
  - label: "10+", description: "Full marketing suite"
- multiSelect: false

**Question 2: Purpose**

- header: "Purpose"
- question: "What will the screenshots be used for?"
- options:
  - label: "Product Hunt", description: "Hero shots and feature highlights"
  - label: "Social media", description: "Eye-catching feature demos"
  - label: "Landing page", description: "Marketing sections and benefits"
  - label: "Documentation", description: "UI reference and tutorials"
- multiSelect: false

**Question 3: Authentication**

- header: "Auth"
- question: "Does the app require login to access the features?"
- options:
  - label: "No login needed (Recommended)", description: "Public pages only"
  - label: "Yes, I'll provide credentials", description: "Need to log in first"
- multiSelect: false

If "Yes, I'll provide credentials" → follow-up **AskUserQuestion**:

- header: "Login Details"
- question: "What are the login credentials? (login URL, email, password)"
- options:
  - label: "I'll type them below", description: "Provide credentials as free text"

**Question 4: Dark Mode**

- header: "Dark Mode"
- question: "Do you also want dark mode variants?"
- options:
  - label: "No (Recommended)", description: "Light mode only"
  - label: "Yes, both themes", description: "Light + dark variant per screenshot"
- multiSelect: false

**Question 5: Social Cards**

- header: "Social Cards"
- question: "Do you also want to generate social media preview cards?"
- options:
  - label: "No (Recommended)", description: "Feature screenshots only"
  - label: "OG (Facebook/LinkedIn)", description: "Open Graph preview — 1200×630"
  - label: "Twitter card", description: "summary_large_image — 1200×600"
  - label: "Both formats", description: "OG + Twitter card variants"
- multiSelect: false

**Question 6: Mobile screenshots**

- header: "Mobile screenshots"
- question: "Do you also want mobile viewport screenshots?"
- options:
  - label: "No (Recommended)", description: "Desktop 1440×900 only"
  - label: "Yes, iPhone portrait", description: "390×844 @3x — App Store and Product Hunt mobile"
  - label: "Both", description: "Desktop + mobile per feature"
- multiSelect: false

**Question 7: GIF demo**

- header: "GIF demo"
- question: "Do you also want a short GIF demo of an interaction (e.g. a flow or feature in action)?"
- options:
  - label: "No (Recommended)", description: "Static screenshots only"
  - label: "Yes, record one", description: "Captures a short interaction via Claude-in-Chrome — requires a live local Chrome"
- multiSelect: false

## PHASE 2: Analyze Codebase for Features

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Research context check:** Search for `.project/thinking/*-marketing-research.md`. If found: load the Audience and Recommendations sections. Use the recommended channels and audience as context when prioritizing features in step 3 — features that align with the research context get priority in the screenshot plan. This is a soft hint, not a blocking step.

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

| #            | Feature | URL Path | Description     | Required State                           |
| ------------ | ------- | -------- | --------------- | ---------------------------------------- |
| 1            | {name}  | {path}   | {what it shows} | {logged in / public / modal open / etc.} |
| FEATURES_END |

APP_DESCRIPTION: {1-2 sentence summary of what the app does}
THEME_SUPPORT: {yes/no}

```

Parse the structured output from the agent.

## PHASE 3: Plan Screenshots with User

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Display discovered features:

```

FEATURES FOUND: {app description}

| #   | Feature | URL | Description | Status |
| --- | ------- | --- | ----------- | ------ |

{features table from agent}

Suggested screenshots: {count based on PHASE 1 selection}

```

Use **AskUserQuestion**:

- header: "Feature Selection"
- question: "Which features do you want to screenshot? (numbers)"
- options:
  - label: "All of the above (Recommended)", description: "Screenshots of all discovered features"
  - label: "I'll pick specific ones", description: "I'll specify which numbers"
- multiSelect: false

If "I'll pick specific ones" → ask for numbers.

After selection, assign numbered filenames:

```

SCREENSHOT PLAN:

| #   | File                  | Feature   | URL   |
| --- | --------------------- | --------- | ----- |
| 1   | 01-{feature-slug}.png | {feature} | {url} |
| 2   | 02-{feature-slug}.png | {feature} | {url} |

...

````

Create output directory:

```bash
mkdir -p .project/screenshots
````

## PHASE 4: Capture Screenshots

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### Primary Method: HiDPI via playwright-cli run-code

Use `playwright-cli run-code` with `deviceScaleFactor: 2` for true retina-quality screenshots (2880x1800px output from 1440x900 viewport).

### 4.0 Auth Setup (only if credentials were provided)

Login once, save state, reuse for all subsequent screenshots (including dark variants). See `../shared/PLAYWRIGHT.md` → Use Cases: Auth State Persistence.

```bash
# 1. Open login page + grab refs
playwright-cli open {login_url}
playwright-cli snapshot                            # note refs for email/password/submit

# 2. Fill in via direct interactions
playwright-cli fill [email-ref] "{email}"
playwright-cli fill [password-ref] "{password}"
playwright-cli click [submit-ref]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"

# 3. Save storage state (cookies + localStorage)
playwright-cli state-save .project/auth-state.json
```

On login failure (smart-pattern matching fails): fall back to manual selectors via `playwright-cli snapshot` to identify refs, then retry step 2.

### 4.1 Screenshot Template

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    // STORAGE_STATE (only if auth used):
    // storageState: '.project/auth-state.json',
  });
  const p = await ctx.newPage();

  await p.goto('{url}');
  await p.waitForLoadState('networkidle');

  // ACTIONS_BLOCK (if needed: click tabs, open modals, scroll)
  // await p.click('{selector}');
  // await p.waitForTimeout(500);

  await p.screenshot({ path: '.project/screenshots/{filename}', fullPage: false });
  await ctx.close();
  return 'Captured: {filename}';
}"
```

**For dark mode variants** (if requested) — add `colorScheme: 'dark'` to `newContext`. `storageState` stays the same, so auth is automatically reused.

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    // storageState: '.project/auth-state.json',  (if auth)
  });
  // ... same navigation + screenshot with '-dark' suffix
}"
```

**For mobile variants** (if requested in PHASE 1) — iPhone 14 portrait, native 3x scale:

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    // storageState: '.project/auth-state.json',  (if auth)
  });
  const p = await ctx.newPage();

  await p.goto('{url}');
  await p.waitForLoadState('networkidle');

  await p.screenshot({ path: '.project/screenshots/{filename}-mobile.png', fullPage: false });
  await ctx.close();
  return 'Captured: {filename}-mobile.png';
}"
```

**For mobile + dark mode** (if both chosen) — same mobile viewport with `colorScheme: 'dark'`:

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    // storageState: '.project/auth-state.json',  (if auth)
  });
  const p = await ctx.newPage();

  await p.goto('{url}');
  await p.waitForLoadState('networkidle');

  await p.screenshot({ path: '.project/screenshots/{filename}-mobile-dark.png', fullPage: false });
  await ctx.close();
  return 'Captured: {filename}-mobile-dark.png';
}"
```

### 4.2 Social Card Capture (only if chosen in PHASE 1)

Per selected feature/route, in order of precedence:

**Strategy A — Meta extraction (preferred):**

```
playwright-cli goto {url}
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli eval "() => ({
  ogImage: document.querySelector('meta[property=\"og:image\"]')?.content,
  ogTitle: document.querySelector('meta[property=\"og:title\"]')?.content,
  twitterCard: document.querySelector('meta[name=\"twitter:card\"]')?.content,
  twitterImage: document.querySelector('meta[name=\"twitter:image\"]')?.content,
})"
```

If `ogImage` URL is available:

```js
// playwright-cli run-code
async (page) => {
  const res = await fetch("{ogImage}");
  const buf = Buffer.from(await res.arrayBuffer());
  require("fs").writeFileSync(
    ".project/screenshots/og-{feature-slug}.png",
    buf,
  );
  return `Saved: og-{feature-slug}.png (${buf.length} bytes)`;
};
```

Validation: `file .project/screenshots/og-{feature}.png` → dimensions 1200×630.

**Strategy B — Page-render mock (fallback, if no OG image or URL not reachable):**

```js
// playwright-cli run-code
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 }, // or 1200×600 for Twitter
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.waitForLoadState("networkidle");
  await p.screenshot({ path: ".project/screenshots/og-{feature-slug}.png" });
  await ctx.close();
};
```

Twitter variant: same with `viewport: { width: 1200, height: 600 }` and `-tw-` filename suffix.

**Findings (reporting, non-blocking):**

- OG meta tags missing on feature (no og:image, og:title)
- OG image dimensions incorrect — expected 1200×630
- Twitter card type missing (`meta[name="twitter:card"]` not present)

### 4.3 GIF Capture (only if chosen in PHASE 1, Claude-in-Chrome)

No Playwright equivalent — uses the built-in Claude-in-Chrome MCP tools against a live local Chrome. See `../shared/CLAUDE-IN-CHROME.md` for the full tool-loading ritual and command mapping.

1. Load the tools in one `ToolSearch` call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__gif_creator`.
2. Call `tabs_context_mcp` first. If no live browser is connected: skip GIF capture, note in the PHASE 5 summary as `GIF: skipped — no live Chrome connected`.
3. `navigate` to the feature URL selected for the demo.
4. Use `gif_creator` to record the interaction (e.g. opening a modal, switching a tab, completing a short flow).
5. Save the resulting GIF to `.project/screenshots/{feature-slug}-demo.gif`.

### Execution Flow

1. If credentials provided → run 4.0 (login + state-save) once.
2. Per screenshot:
   - Log: `Capturing {n}/{total}: {feature name}...`
   - Run template from 4.1 (with `storageState` if auth, otherwise without)
   - Wait for content to load (networkidle in template)
   - Execute pre-screenshot actions if needed (open modal, select tab, scroll)
   - Capture screenshot
   - If dark mode requested → capture dark variant (suffix `-dark`)
   - If mobile requested → capture mobile variant (390×844 @3x, suffix `-mobile`)
   - If both dark AND mobile → capture mobile-dark variant (suffix `-mobile-dark`)
   - Log: `Saved: {filename}`
3. If social cards chosen → per feature: run 4.2 (meta extraction first, fallback to render mock)
4. If GIF demo chosen → run 4.3 once (Claude-in-Chrome, or skip cleanly if no live Chrome)

## PHASE 5: Verify and Summarize

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

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

   | # | File | Feature | Dimensions |
   |---|------|---------|------------|
   | 1 | 01-dashboard-overview.png | Dashboard | 2880x1800 |
   | 2 | 02-settings-panel.png | Settings | 2880x1800 |
   ...

   Total: {n} screenshots in .project/screenshots/
   Desktop: HiDPI 2x retina — 2880×1800 output
   Mobile:  {n} mobile shots — 1170×2532 output (390×844 @3x)  ← only if chosen
   Purpose: {purpose from PHASE 1}
   ```

4. If social cards generated → show social card summary:

   ```
   SOCIAL CARDS
   | Feature    | OG image                | Twitter image              | Source          |
   |------------|-------------------------|----------------------------|-----------------|
   | homepage   | og-homepage.png (1200×630) | tw-homepage.png (1200×600) | meta-extracted |
   | dashboard  | og-dashboard.png        | —                          | page-render     |

   Findings:
   - [feature]: OG meta tags missing (og:image, og:title)
   - [feature]: OG image dimensions [actual] — expected 1200×630
   ```

5. If GIF demo generated → add one line: `GIF: {feature-slug}-demo.gif` (or `GIF: skipped — no live Chrome connected`)
6. If purpose is "Product Hunt" → mention recommended image sizes (1270x760)
7. If purpose is "Social media" → suggest cropping for platform-specific ratios

> **Todo**: mark PHASE 5 → `completed`.

7. Clean up auth state (only if 4.0 was run):

   ```bash
   rm -f .project/auth-state.json
   ```

   State contains session tokens — always clean up at end of run.

## Error Handling

### App not reachable

**Cause:** Dev server not running.
**Solution:** Start with `/project-tunnel` or provide a live URL. The skill does not start servers itself.

### Login failed

**Cause:** Smart login patterns don't match the app's login form.
**Solution:** `playwright-cli snapshot` on the login page → manually identify refs for email/password/submit → retry PHASE 4.0 with correct refs. On persistent failure: use `run-code` with explicit CSS selectors as fallback for the login + state-save step.

### State file expired / invalid

**Cause:** `auth-state.json` contains expired cookies (session expired between runs).
**Solution:** Delete `.project/auth-state.json` and re-run PHASE 4.0. State is cleaned up in PHASE 5 anyway — always recreate when reusing between sessions.

### run-code fails

**Cause:** Syntax error in the JavaScript argument (quote escaping).
**Solution:** Write the script to a temporary file and use `playwright-cli run-code --filename=script.js`.

### Screenshot is blank or incomplete

**Cause:** Page not fully loaded before screenshot.
**Solution:** Increase wait time via `page.waitForTimeout(2000)` in the run-code script, or use `page.waitForLoadState('networkidle')` before capture.

## Restrictions

This skill must NEVER:

- Install npm packages or dependencies
- Start dev servers (use `/project-tunnel` for that)
- Store raw credentials (email/password) in files — only post-login storage state via `state-save` is allowed
- Commit `.project/auth-state.json` — must be gitignored
- Overwrite existing screenshots without user confirmation
- Take screenshots without user-approved plan

This skill must ALWAYS:

- Verify the app URL is reachable before starting
- Present the screenshot plan for user approval
- Capture HiDPI (2x retina) via `playwright-cli run-code` with `deviceScaleFactor: 2`
- Use `--filename` flag for all screenshots (path to `.project/screenshots/`)
- Report actual dimensions in the summary
- Clean up browser contexts after use
- Delete `.project/auth-state.json` at the end of PHASE 5 if auth was used
