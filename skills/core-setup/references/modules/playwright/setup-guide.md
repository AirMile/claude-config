# Playwright Setup

## Detection

Check both packages separately:

- **Daemon** (`@playwright/cli`): `npm list -g @playwright/cli 2>/dev/null` produces output, OR `playwright-cli --version` succeeds
- **Runner** (`@playwright/test`): `@playwright/test` in `package.json` devDependencies AND `playwright.config.ts` or `playwright.config.js` present

Store as `$HAS_DAEMON` and `$HAS_RUNNER` (true/false).

## Install

```yaml
header: "Playwright"
question: "Which Playwright component do you want to install?"
options:
  - label: "Both (Recommended)"
    description: "Daemon for ad-hoc inspection + Runner for visual regression and a11y-baselines"
  - label: "Daemon only (@playwright/cli)"
    description: "REPL-style browser — screenshot, snapshot, console, network. No spec files needed."
  - label: "Runner only (@playwright/test)"
    description: "Test suite with toHaveScreenshot, toMatchAriaSnapshot, --trace. Spec files required."
multiSelect: false
```

### Install daemon

```bash
npm install -g @playwright/cli@latest
npx @playwright/cli install chromium
```

Verify: `playwright-cli --version`

### Install runner

Use the detected package manager:

```bash
# npm
npm install --save-dev @playwright/test @axe-core/playwright
# pnpm
pnpm add -D @playwright/test @axe-core/playwright
# yarn
yarn add -D @playwright/test @axe-core/playwright
# bun
bun add -d @playwright/test @axe-core/playwright
```

Then download browsers (Chromium only for dev — smaller, faster):

```bash
npx playwright install chromium
```

Generate base `playwright.config.ts` (write to project root):

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

- **Next.js**: add to config:
  ```typescript
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  ```
- **Vite**: same but `command: "npm run dev"` on port 5173 and `url: "http://localhost:5173"`

## Gitignore

Add to `.gitignore` (check if already present first):

```bash
grep -q "playwright-report" .gitignore 2>/dev/null || echo "playwright-report/" >> .gitignore
grep -q "test-results" .gitignore 2>/dev/null || echo "test-results/" >> .gitignore
grep -q "playwright-runs" .gitignore 2>/dev/null || echo ".project/playwright-runs/" >> .gitignore
```

## Verification

**Daemon**: `playwright-cli --version` → semver output

**Runner**: write a temporary smoke spec and verify:

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

Exit code 0 = installation successful.

## Teardown

1. Daemon: `npm uninstall -g @playwright/cli`
2. Runner: remove `@playwright/test` from devDependencies
3. Delete `playwright.config.ts`
4. Delete `tests/` or `e2e/` directory (if present)
5. Delete browser binaries (optional, ask user): `rm -rf ~/.cache/ms-playwright`
6. Delete `.project/playwright-runs/` directory

## Notes

- Browsers (~300MB per browser). With `install chromium` you only download Chromium (~100MB) — sufficient for most skill workflows.
- `snapshotDir` in config points to `.project/playwright-runs/__screenshots__/` — all skills write their `toHaveScreenshot`/`toMatchAriaSnapshot` baselines there. Gitignored, but reusable across sessions.
- See `shared/PLAYWRIGHT.md` for the full on-the-fly spec pattern that skills use for visual regression and a11y snapshots.
