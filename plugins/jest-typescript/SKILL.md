---
name: jest-typescript
description: Configure and write Jest tests in TypeScript using ts-jest or Babel, with mocking, snapshots, async assertions, and coverage. Use when authoring or debugging Jest tests for TypeScript code, picking between ts-jest and @swc/jest, or hunting down type errors in jest.config.ts and jest.mock factories.
---

# Jest with TypeScript

Jest is a batteries-included test runner with built-in assertions, mocking, and coverage. With TypeScript you either transpile via `ts-jest` (slower, typechecks) or via `@swc/jest` / `babel-jest` (fast, no typechecking). This guide covers configuration, mocking semantics, and the pitfalls that come from mixing Jest's runtime-hoisted `jest.mock` with TypeScript's static types.

## Use this skill when
- Setting up a fresh Jest + TypeScript project (`jest.config.ts`, `tsconfig`, transformer)
- Choosing between `ts-jest`, `@swc/jest`, and `babel-jest`
- Writing or fixing `jest.mock`, `jest.spyOn`, or manual `__mocks__` for typed modules
- Debugging "Cannot find name 'jest'" or `ReferenceError` from hoisted mocks
- Tuning coverage thresholds and excluding files
- Migrating tests that hit timer, async, or ESM boundaries

## Do not use this skill when
- Running tests in a real browser (use Playwright or Cypress component testing)
- Writing tests for Vite/Vitest projects (use the vitest-pro skill)
- You need a typecheck-only pass; run `tsc --noEmit` instead

## Core concepts

- **Transformer**: turns `.ts/.tsx` into JS Jest can execute. `ts-jest` uses the TS compiler; `@swc/jest` uses SWC; `babel-jest` uses Babel with `@babel/preset-typescript`. SWC/Babel strip types only and do not catch type errors.
- **Hoisting**: `jest.mock('mod')` is hoisted to the top of the file by Jest's Babel plugin. Anything referenced inside the factory must also be hoistable or prefixed with `mock` (e.g. `mockFn`).
- **Module registry**: each test file gets a fresh module registry unless `jest.isolateModules` is used. `jest.resetModules()` clears it.
- **Spies vs mocks**: `jest.spyOn(obj, 'm')` wraps a real method (restorable). `jest.fn()` is a bare mock. `jest.mock('mod')` replaces the whole module.
- **ESM**: native ESM support is experimental; most projects keep CommonJS output via `tsconfig` `module: "commonjs"` for tests, or use `--experimental-vm-modules`.

## Quick start

```ts
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  clearMocks: true,
};

export default config;
```

```ts
// src/user.test.ts
import { getUser } from './user';
import * as db from './db';

jest.mock('./db'); // hoisted; auto-mocks every export as jest.fn()

const mockedDb = jest.mocked(db); // typed wrapper, preserves signatures

beforeEach(() => {
  mockedDb.findUser.mockResolvedValue({ id: 1, name: 'Ada' });
});

test('getUser returns the user from db', async () => {
  await expect(getUser(1)).resolves.toEqual({ id: 1, name: 'Ada' });
  expect(mockedDb.findUser).toHaveBeenCalledWith(1);
});
```

## Key patterns

- **Typed mocks**: prefer `jest.mocked(module)` over `as jest.Mocked<typeof module>`. It preserves overloads and is the official API since Jest 27.
- **Partial module mock**: `jest.mock('./db', () => ({ ...jest.requireActual('./db'), findUser: jest.fn() }))` keeps real exports for the parts you do not override.
- **Async assertions**: use `await expect(promise).resolves.toEqual(...)` or `.rejects.toThrow(...)`. Do not mix `done` callbacks with `async` functions.
- **Timers**: `jest.useFakeTimers()` then `jest.advanceTimersByTime(ms)`. Restore with `jest.useRealTimers()` in `afterEach`.
- **Snapshots**: `expect(value).toMatchSnapshot()` for stable output, `toMatchInlineSnapshot()` for tiny ones. Review snapshot diffs in code review; regenerate with `jest -u` only after verifying the change.
- **Setup files**: `setupFiles` runs before the framework loads (good for polyfills). `setupFilesAfterEach` runs after Jest globals exist (good for `expect.extend`, `beforeEach`).

## Common pitfalls

- **`jest.mock` hoisting captures `undefined`**: variables declared at file top are hoisted as declarations but not assigned. Reference them inside the factory only via a `mock`-prefixed name, which Jest's hoister allows.
- **Type drift between mock and real module**: `jest.mock('mod', () => ({ foo: jest.fn() }))` is not typechecked against the real module. Use `jest.mocked` after the fact to catch drift.
- **`ts-jest` is slow on large suites**: switch to `@swc/jest` for CI speed and run `tsc --noEmit` separately for type safety.
- **`clearMocks` vs `resetMocks` vs `restoreMocks`**: `clear` zeroes call history, `reset` also removes implementations, `restore` only affects `jest.spyOn` wrappers. Pick one in config and stick with it.
- **`__esModule` interop**: when mocking a default export with TS `esModuleInterop`, the factory must return `{ __esModule: true, default: jest.fn() }`.
- **Open handles**: timers, sockets, and DB pools left open cause `--detectOpenHandles` warnings. Close them in `afterAll` or use `--forceExit` only as a last resort.

## Reference
- https://jestjs.io/docs/getting-started
- https://kulshekhar.github.io/ts-jest/
- https://swc.rs/docs/usage/jest
