---
name: vitest-pro
description: Configure and write Vitest tests with Vite-native speed, ESM-first semantics, in-source testing, vi.mock hoisting, browser mode, and Jest migration. Use when setting up vitest.config.ts, picking between c8 and istanbul coverage, debugging vi.mock hoist order, or porting a Jest suite over.
---

# Vitest Pro

Vitest is a Vite-native test runner that reuses your existing `vite.config.ts` plugins and resolvers. It is ESM-first, fast under watch mode, and ships a Jest-compatible API (`describe`, `it`, `expect`) with extra primitives like `expect.poll` and in-source tests. The mental model is "Jest, but inside Vite," which means transform errors look like Vite errors and module resolution follows Vite rules.

## Use this skill when
- Standing up a new test suite in a Vite project (Vue, React, Svelte, SvelteKit, SolidStart)
- Migrating from Jest and hitting ESM, import.meta, or alias-resolution issues
- Writing tests that need browser DOM via `@vitest/browser` (Playwright or WebdriverIO driver)
- Tuning watch performance, coverage providers (`v8` vs `istanbul`), or workspace setups
- Using `expect.poll`, `vi.useFakeTimers`, or in-source `if (import.meta.vitest)` blocks

## Do not use this skill when
- The project has no Vite/Rollup pipeline; Jest may be simpler
- You need a full end-to-end browser harness with multiple tabs (use Playwright)
- You only need a type-level test runner (use `tsd` or `expect-type`)

## Core concepts

- **Config merging**: Vitest reads `vitest.config.ts` if present, otherwise the `test` block of `vite.config.ts`. Plugins, aliases, and `define` are shared with the app build.
- **Pool**: by default Vitest runs each test file in a worker thread (`pool: 'threads'`). Use `'forks'` for native modules that crash in workers, `'vmThreads'` for legacy CJS isolation.
- **Hoisting**: `vi.mock(path, factory)` is hoisted to the top of the file by the Vitest transformer. Use `vi.hoisted(() => ...)` to lift other declarations alongside it.
- **In-source testing**: tests can live inside production files under `if (import.meta.vitest)`, stripped from the build by Vite's dead-code elimination.
- **Coverage**: `@vitest/coverage-v8` uses V8 native coverage (fast, no instrumentation). `@vitest/coverage-istanbul` instruments code (more accurate branch coverage, slower).

## Quick start

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,            // prefer explicit imports from 'vitest'
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
```

```ts
// src/sum.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchPrice } from './price';

vi.mock('./api', () => ({ getQuote: vi.fn().mockResolvedValue(42) }));

describe('fetchPrice', () => {
  it('returns the quoted price', async () => {
    await expect(fetchPrice('AAPL')).resolves.toBe(42);
  });

  it('polls until value stabilises', async () => {
    let n = 0;
    await expect.poll(() => ++n, { timeout: 1000 }).toBeGreaterThan(3);
  });
});
```

## Key patterns

- **`vi.hoisted` for shared mocks**: `const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))` then reference `mocks.getUser` inside `vi.mock`. This avoids the "Cannot access before initialization" trap.
- **In-source tests**: keep small pure-function tests next to code; Rollup's `import.meta.vitest` define strips them at build time. Add `"vitest"` to `tsconfig` `types`.
- **Browser mode**: `test: { browser: { enabled: true, provider: 'playwright', name: 'chromium' } }` runs assertions in a real browser. Useful for components that touch `ResizeObserver`, `IntersectionObserver`, or layout APIs JSDOM lacks.
- **Snapshot files**: inline snapshots (`toMatchInlineSnapshot`) update in place; file snapshots land next to the test in `__snapshots__/`. Use `--update` (not `-u`) to refresh.
- **Workspace**: a root `vitest.workspace.ts` lets a monorepo run unit, browser, and node suites with one command and one report.
- **Type tests**: `expectTypeOf<T>().toEqualTypeOf<U>()` checks types at compile time without runtime cost.

## Common pitfalls

- **Jest API gaps**: `jest.requireActual` is `vi.importActual` and is async. `jest.fn().mockReturnThis()` is the same, but `mockName` chaining is `mockImplementation` only. Test setup that paths through `setupFilesAfterEach` becomes `setupFiles` with explicit `beforeEach`.
- **ESM-only deps double-loaded**: when a dep is both CJS and ESM, mismatched `pool` choices can give two copies. Pin via `server.deps.inline` or `optimizeDeps`.
- **`globals: true` masks lint errors**: prefer explicit `import { describe } from 'vitest'`; ESLint's `no-undef` catches typos instead of silently passing.
- **Coverage misses untouched files**: V8 provider only reports files that were imported. Add `coverage.include` patterns to force inclusion.
- **`vi.useFakeTimers` is sticky**: forgetting `vi.useRealTimers()` in `afterEach` makes downstream files hang on `setTimeout`-based libs (e.g. axios retry).
- **Watch mode and TypeScript paths**: aliases must be declared in `vite.config.ts`, not just `tsconfig.json`. Use `vite-tsconfig-paths` to bridge them.

## Reference
- https://vitest.dev/guide/
- https://vitest.dev/api/vi.html
- https://vitest.dev/guide/browser/
- https://vitest.dev/guide/migration.html
