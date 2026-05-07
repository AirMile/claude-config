---
name: marketing-promo
argument-hint: "[url]"
description: >-
  Generate marketing-quality screenshots of a web app via Playwright CLI.
  Use with /marketing-promo [url] for Product Hunt, social media, landing
  pages, or documentation. Analyzes codebase to discover routes and features.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: marketing
---

# Screenshots

Generate marketing-quality screenshots of a web app using Playwright CLI. Analyzes the codebase to discover routes and features, plans screenshots with the user, and captures them at HiDPI resolution.

**Trigger**: `/marketing-promo` or `/marketing-promo [url]`

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

4. Verify the URL is reachable via `playwright-cli open [url]`. If it fails → exit with message to start the dev server first (e.g. `/dev-tunnel`).

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

**Question 5: Social Cards**

- header: "Social Cards"
- question: "Wil je ook social media preview cards genereren?"
- options:
  - label: "Nee (Recommended)", description: "Alleen feature screenshots"
  - label: "OG (Facebook/LinkedIn)", description: "Open Graph preview — 1200×630"
  - label: "Twitter card", description: "summary_large_image — 1200×600"
  - label: "Beide formaten", description: "OG + Twitter card varianten"
- multiSelect: false

**Question 6: Mobiele screenshots**

- header: "Mobiele screenshots"
- question: "Wil je ook mobiele viewport screenshots?"
- options:
  - label: "Nee (Recommended)", description: "Alleen desktop 1440×900"
  - label: "Ja, iPhone portrait", description: "390×844 @3x — App Store en Product Hunt mobile"
  - label: "Beide", description: "Desktop + mobile per feature"
- multiSelect: false

## FASE 2: Analyze Codebase for Features

**Research context check:** Zoek naar `.project/thinking/*-marketing-research.md`. Als
gevonden: laad de Doelgroep en Aanbevelingen secties. Gebruik de aanbevolen kanalen en
doelgroep als context bij feature-prioritering in stap 3 — features die aansluiten bij
de onderzoekscontext krijgen voorrang in het screenshot-plan. Dit is een zachte hint,
geen blokkerende stap.

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

### Primary Method: HiDPI via playwright-cli run-code

Use `playwright-cli run-code` met `deviceScaleFactor: 2` voor true retina-quality screenshots (2880x1800px output van 1440x900 viewport).

### 4.0 Auth Setup (alleen als credentials zijn opgegeven)

Login één keer, save state, herbruik voor alle volgende screenshots (incl. dark variants). Zie `../shared/PLAYWRIGHT.md` → Use Cases: Auth State Persistence.

```bash
# 1. Open login page + grab refs
playwright-cli open {login_url}
playwright-cli snapshot                            # noteer refs voor email/password/submit

# 2. Vul in via direct interactions
playwright-cli fill [email-ref] "{email}"
playwright-cli fill [password-ref] "{password}"
playwright-cli click [submit-ref]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"

# 3. Save storage state (cookies + localStorage)
playwright-cli state-save .project/auth-state.json
```

Bij login-failure (smart-pattern matching mislukt): val terug op handmatige selectors via `playwright-cli snapshot` om refs te identificeren, dan retry stap 2.

### 4.1 Screenshot Template

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    // STORAGE_STATE (alleen als auth gebruikt):
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

**For dark mode variants** (if requested) — voeg `colorScheme: 'dark'` toe aan `newContext`. `storageState` blijft hetzelfde, dus auth wordt automatisch hergebruikt.

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    // storageState: '.project/auth-state.json',  (als auth)
  });
  // ... same navigation + screenshot met '-dark' suffix
}"
```

**For mobile variants** (if requested in FASE 1) — iPhone 14 portrait, native 3x scale:

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    // storageState: '.project/auth-state.json',  (als auth)
  });
  const p = await ctx.newPage();

  await p.goto('{url}');
  await p.waitForLoadState('networkidle');

  await p.screenshot({ path: '.project/screenshots/{filename}-mobile.png', fullPage: false });
  await ctx.close();
  return 'Captured: {filename}-mobile.png';
}"
```

**For mobile + dark mode** (als beide gekozen) — zelfde mobile viewport met `colorScheme: 'dark'`:

```bash
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    // storageState: '.project/auth-state.json',  (als auth)
  });
  const p = await ctx.newPage();

  await p.goto('{url}');
  await p.waitForLoadState('networkidle');

  await p.screenshot({ path: '.project/screenshots/{filename}-mobile-dark.png', fullPage: false });
  await ctx.close();
  return 'Captured: {filename}-mobile-dark.png';
}"
```

### 4.2 Social Card Capture (alleen als gekozen in FASE 1)

Per geselecteerde feature/route, in volgorde van precedence:

**Strategie A — Meta-extractie (preferred):**

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

Als `ogImage` URL beschikbaar:

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

Validatie: `file .project/screenshots/og-{feature}.png` → dimensies 1200×630.

**Strategie B — Page-render mock (fallback, als geen OG image of URL niet bereikbaar):**

```js
// playwright-cli run-code
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 }, // of 1200×600 voor Twitter
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.waitForLoadState("networkidle");
  await p.screenshot({ path: ".project/screenshots/og-{feature-slug}.png" });
  await ctx.close();
};
```

Twitter-variant: hetzelfde met `viewport: { width: 1200, height: 600 }` en `-tw-` filename suffix.

**Findings (rapportage, geen blokkerende fix):**

- OG meta tags ontbreken op feature (geen og:image, og:title)
- OG image dimensies kloppen niet — verwacht 1200×630
- Twitter card type ontbreekt (`meta[name="twitter:card"]` niet aanwezig)

### Execution Flow

1. Als credentials opgegeven → run 4.0 (login + state-save) één keer.
2. Per screenshot:
   - Log: `Capturing {n}/{total}: {feature name}...`
   - Run template uit 4.1 (met `storageState` als auth, anders zonder)
   - Wait for content to load (networkidle in template)
   - Execute pre-screenshot actions if needed (open modal, select tab, scroll)
   - Capture screenshot
   - If dark mode requested → capture dark variant (suffix `-dark`)
   - If mobile requested → capture mobile variant (390×844 @3x, suffix `-mobile`)
   - If both dark AND mobile → capture mobile-dark variant (suffix `-mobile-dark`)
   - Log: `Saved: {filename}`
3. Als social cards gekozen → per feature: run 4.2 (eerst meta-extractie, fallback naar render mock)

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
   Desktop: HiDPI 2x retina — 2880×1800 output
   Mobiel:  {n} mobile shots — 1170×2532 output (390×844 @3x)  ← alleen als gekozen
   Doel: {purpose from FASE 1}
   ```

4. Als social cards gegenereerd → toon social card summary:

   ```
   SOCIAL CARDS
   | Feature    | OG image                | Twitter image           | Source          |
   |------------|-------------------------|-------------------------|-----------------|
   | homepage   | og-homepage.png (1200×630) | tw-homepage.png (1200×600) | meta-extracted |
   | dashboard  | og-dashboard.png        | —                       | page-render     |

   Findings:
   - [feature]: OG meta tags ontbreken (og:image, og:title)
   - [feature]: OG image dimensies [actual] — verwacht 1200×630
   ```

5. If purpose is "Product Hunt" → mention recommended image sizes (1270x760)
6. If purpose is "Social media" → suggest cropping for platform-specific ratios

7. Cleanup auth state (alleen als 4.0 is gedraaid):

   ```bash
   rm -f .project/auth-state.json
   ```

   State bevat session tokens — altijd opruimen aan einde van de run.

## Error Handling

### App not reachable

**Cause:** Dev server not running.
**Solution:** Start with `/dev-tunnel` or provide a live URL. The skill does not start servers itself.

### Login failed

**Cause:** Smart login patterns don't match the app's login form.
**Solution:** `playwright-cli snapshot` op de login-pagina → identificeer refs voor email/password/submit handmatig → retry FASE 4.0 met correcte refs. Bij blijvende failure: gebruik `run-code` met expliciete CSS-selectors als fallback voor de login + state-save stap.

### State file expired / invalid

**Cause:** `auth-state.json` bevat verlopen cookies (sessie geëxpireerd tussen runs).
**Solution:** Verwijder `.project/auth-state.json` en run FASE 4.0 opnieuw. State wordt sowieso opgeruimd in FASE 5 — bij hergebruik tussen sessies altijd opnieuw aanmaken.

### run-code fails

**Cause:** Syntax error in het JavaScript argument (quotes escaping).
**Solution:** Schrijf het script naar een tijdelijk bestand en gebruik `playwright-cli run-code --filename=script.js`.

### Screenshot is blank or incomplete

**Cause:** Page not fully loaded before screenshot.
**Solution:** Verhoog wait time via `page.waitForTimeout(2000)` in het run-code script, of gebruik `page.waitForLoadState('networkidle')` voor capture.

## Restrictions

This skill must NEVER:

- Install npm packages or dependencies
- Start dev servers (use `/dev-tunnel` for that)
- Store raw credentials (email/password) in files — alleen post-login storage state via `state-save` is toegestaan
- Commit `.project/auth-state.json` — moet gitignored zijn
- Overwrite existing screenshots without user confirmation
- Take screenshots without user-approved plan

This skill must ALWAYS:

- Verify the app URL is reachable before starting
- Present the screenshot plan for user approval
- Capture HiDPI (2x retina) via `playwright-cli run-code` met `deviceScaleFactor: 2`
- Gebruik `--filename` flag voor alle screenshots (pad naar `.project/screenshots/`)
- Report actual dimensions in the summary
- Clean up browser contexts after use
- Verwijder `.project/auth-state.json` aan het einde van FASE 5 als auth gebruikt is
