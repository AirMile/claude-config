# Playwright Setup

## Detection

Controleer beide pakketten apart:

- **Daemon** (`@playwright/cli`): `npm list -g @playwright/cli 2>/dev/null` geeft output, OF `playwright-cli --version` succeeds
- **Runner** (`@playwright/test`): `@playwright/test` in `package.json` devDependencies EN `playwright.config.ts` of `playwright.config.js` aanwezig

Sla op als `$HAS_DAEMON` en `$HAS_RUNNER` (true/false).

## Install

```yaml
header: "Playwright"
question: "Welke Playwright-component wil je installeren?"
options:
  - label: "Beide (Recommended)"
    description: "Daemon voor ad-hoc inspectie + Runner voor visual regression en a11y-baselines"
  - label: "Alleen daemon (@playwright/cli)"
    description: "REPL-stijl browser — screenshot, snapshot, console, network. Geen spec-files nodig."
  - label: "Alleen runner (@playwright/test)"
    description: "Test-suite met toHaveScreenshot, toMatchAriaSnapshot, --trace. Spec-files vereist."
multiSelect: false
```

### Daemon installeren

```bash
npm install -g @playwright/cli@latest
npx @playwright/cli install chromium
```

Verify: `playwright-cli --version`

### Runner installeren

Gebruik gedetecteerde package manager:

```bash
# npm
npm install --save-dev @playwright/test
# pnpm
pnpm add -D @playwright/test
# yarn
yarn add -D @playwright/test
# bun
bun add -d @playwright/test
```

Daarna browsers downloaden (alleen Chromium voor dev — kleiner, sneller):

```bash
npx playwright install chromium
```

Genereer base `playwright.config.ts` (schrijf naar project-root):

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  snapshotDir: ".project/playwright-runs/__screenshots__",
  fullyParallel: true,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: ".project/playwright-runs/results.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

**Framework specifics:**

- **Next.js**: voeg toe aan config:
  ```typescript
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  ```
- **Vite**: idem maar `command: "npm run dev"` op port 5173 en `url: "http://localhost:5173"`

## Gitignore

Voeg toe aan `.gitignore` (check eerst of al aanwezig):

```bash
grep -q "playwright-report" .gitignore 2>/dev/null || echo "playwright-report/" >> .gitignore
grep -q "test-results" .gitignore 2>/dev/null || echo "test-results/" >> .gitignore
grep -q "playwright-runs" .gitignore 2>/dev/null || echo ".project/playwright-runs/" >> .gitignore
```

## Verification

**Daemon**: `playwright-cli --version` → semver output

**Runner**: schrijf tijdelijk smoke spec en verifieer:

```bash
mkdir -p .project/playwright-runs
cat > .project/playwright-runs/smoke.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';
test('smoke', async ({ page }) => {
  await page.goto('about:blank');
  expect(await page.title()).toBeDefined();
});
EOF
npx playwright test .project/playwright-runs/smoke.spec.ts --reporter=list
rm .project/playwright-runs/smoke.spec.ts
```

Exit code 0 = installatie geslaagd.

## Teardown

1. Daemon: `npm uninstall -g @playwright/cli`
2. Runner: verwijder `@playwright/test` uit devDependencies
3. Verwijder `playwright.config.ts`
4. Verwijder `tests/` of `e2e/` directory (indien aanwezig)
5. Verwijder browser binaries (optioneel, vraag user): `rm -rf ~/.cache/ms-playwright`
6. Verwijder `.project/playwright-runs/` directory

## Notes

- Browsers (~300MB per browser). Met `install chromium` download je alleen Chromium (~100MB) — voldoende voor de meeste skill-workflows.
- `snapshotDir` in config wijst naar `.project/playwright-runs/__screenshots__/` — hiernaartoe schrijven alle skills hun `toHaveScreenshot`/`toMatchAriaSnapshot` baselines. Gitignored, maar herbruikbaar tussen sessies.
- Zie `shared/PLAYWRIGHT.md` voor het volledige on-the-fly spec pattern dat skills gebruiken voor visual regression en a11y-snapshots.
