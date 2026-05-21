---
name: cypress-e2e
description: Write reliable Cypress end-to-end and component tests with cy.get, cy.intercept, fixtures, custom commands, retries, and parallel CI. Use when authoring or stabilising Cypress specs, hunting flaky tests, mocking the network with cy.intercept, or splitting a suite across CI shards.
---

# Cypress End-to-End Testing

Cypress runs tests inside the browser, giving direct access to the DOM, network, and storage. The runner is opinionated: there is no Promise chaining (commands are queued), and assertions retry automatically. Most flakiness comes from fighting this model with manual waits or async glue, not from Cypress itself.

## Use this skill when
- Writing E2E specs against a deployed or `cy serve`-ready app
- Stabilising flaky CI runs (timing, network, animations)
- Stubbing or asserting network traffic with `cy.intercept`
- Authoring Cypress component tests for React, Vue, Angular, or Svelte
- Parallelising specs across CI shards with Cypress Cloud or GitHub Actions matrices

## Do not use this skill when
- You need multi-tab, multi-origin, or multi-browser-context flows in one test (use Playwright)
- The target is a non-browser CLI or API-only service (use a request library + Jest/Vitest)
- You need true mobile-device automation (use Appium)

## Core concepts

- **Command queue**: `cy.get(...)` does not return a Promise. It schedules work; assertions chained off it retry until passing or until the command timeout (default 4s) elapses.
- **Retry-ability**: only Cypress queries and assertions retry. Anything inside `.then(cb)` runs once. Keep assertions outside `.then`.
- **`cy.intercept`**: routes requests by method+URL, returns stub data, or spies on real traffic. Replaces the older `cy.route` / `cy.server`.
- **Fixtures**: static JSON/files under `cypress/fixtures/`, loaded via `cy.fixture('user.json')`.
- **Custom commands**: extend `cy` via `Cypress.Commands.add('login', ...)` in `cypress/support/commands.ts`.
- **Component vs E2E**: component tests mount one component in isolation; E2E drives a real browser against a running server. They share commands but use different config blocks (`component`, `e2e`).

## Quick start

```ts
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    retries: { runMode: 2, openMode: 0 },
  },
  component: {
    devServer: { framework: 'react', bundler: 'vite' },
  },
});
```

```ts
// cypress/e2e/login.cy.ts
describe('login', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/login', { fixture: 'user.json' }).as('login');
    cy.visit('/login');
  });

  it('signs in and lands on dashboard', () => {
    cy.get('[data-cy=email]').type('ada@example.com');
    cy.get('[data-cy=password]').type('hunter2{enter}');
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.url().should('include', '/dashboard');
  });
});
```

## Key patterns

- **`data-cy` selectors**: tag elements with `data-cy="submit"` and select via `cy.get('[data-cy=submit]')`. CSS classes and text change; test hooks should not.
- **Custom commands for auth**: skip the UI on every spec. `cy.session('user', () => { cy.request('POST', '/api/login', creds).then(... set cookies ...) })` reuses the session across specs.
- **Network-driven waits**: use `cy.wait('@alias')` instead of `cy.wait(2000)`. Aliases are created with `.as(name)` on `cy.intercept` or `cy.request`.
- **Per-test data via fixtures**: `cy.fixture('users/admin.json').then(user => cy.intercept('GET', '/me', user))`. Keep fixtures small and topical.
- **Parallel CI**: in Cypress Cloud, `cypress run --record --parallel` splits specs across machines by historical timing. Without Cloud, shard by file glob in a matrix job.
- **Component tests**: `cy.mount(<Counter />)` from `@cypress/react`. Mock providers via a wrapper component, not via `cy.intercept`, for isolated rendering tests.

## Common pitfalls

- **`cy.wait(ms)` everywhere**: arbitrary sleeps are the top cause of flakiness. Replace with assertions or `@alias` waits that retry.
- **Assertions inside `.then`**: only the first failure inside `.then` retries; chained `.should` outside does. Move assertions out where possible.
- **Animations and CSS transitions**: enable `animationDistanceThreshold` and disable transitions in test mode via a CSS class, or `cy.get(...).should('have.css', 'opacity', '1')`.
- **`cy.intercept` ordering**: define intercepts before the action that triggers them. A `cy.visit` before `cy.intercept` will miss the call.
- **Cross-origin redirects**: Cypress now supports them via `cy.origin('other.com', () => { ... })`. Forgetting `cy.origin` produces a cryptic security error.
- **Memory growth in long suites**: `experimentalMemoryManagement: true` and a `numTestsKeptInMemory: 5` cap help in CI; the default keeps every DOM snapshot in memory.
- **`baseUrl` not set**: relative `cy.visit('/path')` fails without `baseUrl`. Always set it per environment.

## Reference
- https://docs.cypress.io/guides/core-concepts/introduction-to-cypress
- https://docs.cypress.io/api/commands/intercept
- https://docs.cypress.io/guides/component-testing/overview
- https://docs.cypress.io/guides/guides/parallelization
