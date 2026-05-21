---
name: playwright
description: Write Playwright tests in TypeScript with auto-waiting locators, fixtures, traces, network mocking, and parallel projects. Use when authoring page.locator-based specs, debugging with the trace viewer, mocking with page.route, generating tests with codegen, or running cross-browser matrices in CI.
---

# Playwright

Playwright drives Chromium, Firefox, and WebKit out of the box with a single API. Locators auto-wait for visibility, stability, and actionability, so most "wait for element" code is unnecessary. The test runner ships with fixtures, parallelisation, traces, and a UI mode that has largely replaced ad hoc debugging.

## Use this skill when
- Writing cross-browser E2E tests in TypeScript or JavaScript
- Mocking HTTP responses or recording network with `page.route`
- Debugging failing tests with the trace viewer (`playwright show-trace`)
- Generating starter scripts via `playwright codegen`
- Parallelising specs across `projects` (browsers, viewports, authenticated states)
- Adding visual regression with `toHaveScreenshot`

## Do not use this skill when
- You need component-level isolation without rendering a full page (use Vitest + Testing Library or Cypress component tests)
- The target is a native mobile app (use Appium or Maestro)
- You only need unit-test-style assertions (use Jest/Vitest)

## Core concepts

- **Locators**: `page.locator('css=...')` or `page.getByRole('button', { name: 'Save' })`. Locators are lazy descriptors, not element handles. They re-query on each action.
- **Auto-waiting**: actions (`click`, `fill`, `press`) wait for the element to be attached, visible, stable, and enabled before acting. Web-first assertions (`expect(locator).toHaveText`) retry until the assertion passes or the timeout fires.
- **Fixtures**: the `test` object is extended via `test.extend({ ... })` to provide shared setup (logged-in page, API client, seed data) that is automatically torn down.
- **Projects**: defined in `playwright.config.ts`, each project is a named configuration (browser, baseURL, storage state). The runner executes them in parallel.
- **Traces**: per-test recording of DOM, network, console, and screenshots. View with `npx playwright show-trace trace.zip` or in `--ui` mode.

## Quick start

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
});
```

```ts
// tests/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/cart', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.goto('/cart');
});

test('adds an item and checks out', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('$9.99');
  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout/);
});
```

## Key patterns

- **Role-based locators first**: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId`. They are stable across refactors and accessible by design.
- **Storage state for auth**: log in once in `global.setup.ts`, save with `await context.storageState({ path: 'auth.json' })`, then reuse via `use: { storageState: 'auth.json' }` in a project.
- **API + UI mixing**: `request: APIRequestContext` fixture lets you seed via REST then drive the UI, e.g. `await request.post('/api/users', { data })`.
- **`page.route` for stubbing**: intercept by glob; call `route.fulfill`, `route.continue`, or `route.abort`. Use `route.fetch` to inspect a real response before tweaking it.
- **Visual regression**: `await expect(page).toHaveScreenshot('home.png', { maxDiffPixelRatio: 0.01 })`. Baselines live next to the spec; regenerate with `--update-snapshots`.
- **Codegen for scaffolding**: `npx playwright codegen http://localhost:3000` records clicks and produces locator-based test stubs. Treat the output as a starting point; rewrite ambiguous selectors.

## Common pitfalls

- **Mixing `page.locator` with `await elementHandle`**: handles do not auto-retry. Stick to locators unless you need a stale reference for diagnostics.
- **Asserting with `expect(await locator.textContent())`**: this evaluates once and does not retry. Use `expect(locator).toHaveText(...)` instead.
- **Global timeout vs assertion timeout**: `test.setTimeout` covers the whole test; `expect.configure({ timeout: ms })` covers a single assertion. Mixing them up causes confusing failures.
- **`fullyParallel` and shared state**: tests in the same file run on a single worker by default; `fullyParallel: true` splits them across workers, which breaks tests that mutate shared module state.
- **`page.route` race**: register routes before navigating. A route added after `goto` will not match the in-flight document request.
- **Storage state staleness**: if you change auth flow, regenerate the saved state. A 401 redirect at test start is the usual symptom.
- **Trace viewer not opening**: traces only land on configured events (`on`, `retain-on-failure`, `on-first-retry`). Set the right mode in `use.trace`.

## Reference
- https://playwright.dev/docs/intro
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/docs/network
