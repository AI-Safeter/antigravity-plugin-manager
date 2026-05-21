---
name: nx-monorepo
description: 'Nx for monorepo management with code generation, project dependency graph, affected commands, and computation caching. Use this skill when initializing an Nx workspace, authoring project.json or nx.json, defining targets and executors, running nx generate for scaffolding, using nx affected, nx graph, nx run-many, or migrating from Lerna/Turborepo. Triggers: nx, nx.json, project.json, nx generate, nx affected, nx graph, nx run-many, nx migrate, nx release, nx cloud, target defaults, named inputs, executors.'
---

# Nx

Nx is a build system and code-generation toolkit for monorepos. Compared to Turborepo it is more opinionated and feature-rich: it ships executors (reusable task implementations), generators (code scaffolders), a project dependency graph, `nx affected` based on git diff, computation caching (local + Nx Cloud remote), and plugins for React, Next.js, Angular, Vite, Jest, Cypress, Playwright, Storybook, Node, NestJS, Express, and more. Nx works with any package manager and supports both integrated (Nx-managed) and package-based (workspaces-managed) layouts.

## Use this skill when

- Setting up a new Nx workspace (`npx create-nx-workspace`)
- Editing `nx.json` or per-project `project.json` — `targets`, `namedInputs`, `targetDefaults`
- Running `nx generate` for component/lib/app scaffolding via plugins
- Using `nx affected:build`, `nx affected:test` in CI to only run on changed projects
- Inspecting or constraining the project graph with `nx graph` and module boundaries
- Migrating dependencies and Nx itself with `nx migrate`
- Configuring Nx Cloud for remote caching and distributed task execution (DTE)

## Do not use this skill when

- You want a minimal, unopinionated task runner (use Turborepo)
- The repo is a single package (Nx is overkill)
- You need polyglot orchestration outside the JS ecosystem (use Bazel)

## Core concepts

A project is anything with a `project.json` (or implicitly inferred from plugin configs). Each project defines `targets` (build, test, lint, serve, etc.), which run via `executors` (e.g. `@nx/vite:build`) or plain `nx:run-commands`. Nx builds a dependency graph from imports plus explicit `implicitDependencies`, then runs tasks in topological order. Each task's cache key is computed from its `inputs` (files, env vars, runtime constants) plus the dependencies' hashes; matching keys restore outputs from `.nx/cache` or Nx Cloud.

## Quick start

```bash
npx create-nx-workspace@latest my-org --preset=ts
cd my-org
npx nx generate @nx/react:application web
npx nx build web
npx nx graph
```

Minimal `nx.json`:

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "test": { "inputs": ["default", "^production"], "cache": true }
  }
}
```

## Key patterns

### Affected commands
`nx affected -t build` (or the legacy `nx affected:build`) computes which projects changed since the base ref and runs the target only on those plus their dependents:
```bash
nx affected -t build test lint --base=origin/main --head=HEAD
```
In CI, set `NX_BASE` and `NX_HEAD` env vars.

### Generators
`nx generate <collection>:<schematic>` scaffolds code. Common examples:
```bash
nx g @nx/react:library shared-ui
nx g @nx/react:component button --project=shared-ui
nx g @nx/next:app marketing
```
Run with `--dry-run` first to preview changes.

### Executors vs run-commands
Prefer plugin-provided executors (e.g. `@nx/vite:build`, `@nx/jest:jest`) because they expose typed options and integrate with caching. For ad-hoc commands use:
```json
"targets": {
  "deploy": { "executor": "nx:run-commands", "options": { "command": "./scripts/deploy.sh" } }
}
```

### Named inputs
Define reusable input filesets in `nx.json` then reference them per target. `^production` means "the `production` named input of all dependencies." This is the right way to keep cache keys precise.

### Module boundaries
Enforce import rules with `@nx/enforce-module-boundaries` ESLint rule. Tag projects in `project.json` (`"tags": ["scope:web", "type:feature"]`) and constrain in `.eslintrc.json`:
```json
{ "depConstraints": [{ "sourceTag": "type:feature", "onlyDependOnLibsWithTags": ["type:ui", "type:util"] }] }
```

### nx migrate
Upgrade Nx + all installed plugins together:
```bash
nx migrate latest
npm install
nx migrate --run-migrations
```
The migration plan is written to `migrations.json` so you can review before running.

### Nx Cloud
Free tier covers remote caching. Enable with `nx connect`. Distributed Task Execution (DTE) splits a single CI command across N agents — typically cuts wall time 3–10x on large repos.

## Common pitfalls

- **`cache: false` accidentally** — every target you want cached needs `"cache": true` in `targetDefaults` or per-target. Older Nx versions defaulted to true; current versions are explicit.
- **`outputs` mismatch** — outputs not declared correctly means cache hits restore nothing. Use `{options.outputPath}` interpolation when the executor writes the path into options.
- **Inferred targets vs explicit project.json** — Nx 17+ plugins can infer targets from `vite.config.ts`, `jest.config.ts`, etc. Don't duplicate the same target in both places.
- **`nx affected` with shallow clones** — CI checkouts default to depth 1, breaking diff against base. Fetch with `--depth=0` or use `nrwl/nx-set-shas` action.
- **Workspace lib import paths** — libraries are imported by their `paths` entry in `tsconfig.base.json` (e.g. `@my-org/shared-ui`), NOT by relative path. Crossing this boundary breaks the graph.
- **`nx reset`** — when the daemon misbehaves or graph appears stale, `nx reset` clears the cache and restarts the daemon.
- **Mixing `nx.json` `targetDefaults` with project-level overrides** — project-level fully replaces, not merges, the target definition. Use `targetDefaults` for cross-cutting config and override only what differs.
- **Plugin versions out of sync** — keep all `@nx/*` packages on the same version (Nx migrate enforces this). Mismatches cause cryptic executor errors.

## Reference

- Official docs: https://nx.dev/
- Plugin registry: https://nx.dev/plugin-registry
- Configuration reference: https://nx.dev/reference/nx-json
- Related: [[turborepo-monorepo]] (simpler alternative), [[pnpm-workspaces]] (works under Nx)
