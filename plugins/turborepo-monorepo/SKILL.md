---
name: turborepo-monorepo
description: 'Turborepo for monorepo task orchestration, incremental builds, and remote caching. Use this skill when setting up turbo.json, defining task pipelines with dependsOn, configuring inputs/outputs for caching, wiring remote cache (Vercel or self-hosted), filtering tasks with --filter, integrating with pnpm/npm/yarn workspaces, or migrating from Lerna/Nx. Triggers: turborepo, turbo.json, turbo run, turbo build, remote cache, task pipeline, monorepo build, dependsOn, ^build, turbo prune, vercel monorepo.'
---

# Turborepo

Turborepo is a build-system orchestrator for JavaScript/TypeScript monorepos. It does not manage packages (use pnpm/npm/yarn workspaces for that) and does not generate code — it schedules tasks across packages, parallelizes them based on a dependency graph, and caches outputs locally and remotely. The killer feature is content-hashed caching: identical inputs produce a cache hit and tasks complete in milliseconds.

## Use this skill when

- Initializing a new monorepo with `turbo` + pnpm/npm/yarn workspaces
- Authoring or editing `turbo.json` — `tasks`, `dependsOn`, `inputs`, `outputs`, `cache`
- Setting up remote caching (Vercel-hosted or self-hosted via `turbo-cache-server`)
- Using `--filter` to run tasks on a subset of packages (e.g. `--filter=...[origin/main]`)
- Diagnosing cache misses or unexpected re-runs
- Migrating from Lerna, Rush, or pre-Nx monorepo tooling

## Do not use this skill when

- You need code-gen, dependency graph visualization, or affected-test logic out of the box (use Nx instead)
- The repo has only one package (Turborepo offers little)
- You need polyglot task orchestration across non-JS ecosystems (use Bazel or Pants)

## Core concepts

Each task in `turbo.json` has `inputs` (files that affect the task) and `outputs` (files it produces). Turborepo hashes the inputs plus the package's dependencies' hashes plus the task definition; that hash is the cache key. On a cache hit, outputs are restored from `.turbo/cache` (or the remote store) and logs are replayed. `dependsOn` controls topological ordering: `^build` means "build this package's dependencies first."

## Quick start

```bash
pnpm dlx create-turbo@latest
# or in an existing repo:
pnpm add -D turbo -w
```

Minimal `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": { "dependsOn": ["build"], "outputs": [] },
    "lint": { "outputs": [] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

Run:

```bash
pnpm turbo build           # build all packages
pnpm turbo build --filter=web
pnpm turbo build --filter=...[HEAD^1]   # only packages affected since last commit
```

## Key patterns

### dependsOn semantics
- `"build"` → run the `build` task of the same package first.
- `"^build"` → run the `build` task of all this package's workspace dependencies first.
- `"$VAR"` → declare an env var as part of the cache key (use `env` field — see below).

### Caching env vars
List env vars that affect output so cache invalidates correctly:
```json
"build": { "env": ["NODE_ENV", "NEXT_PUBLIC_*"], "passThroughEnv": ["AWS_REGION"] }
```
`env` participates in the hash; `passThroughEnv` is passed to the task but not hashed.

### Persistent tasks
`dev` servers, watchers — set `"persistent": true` and `"cache": false`. Turborepo will refuse to let other tasks `dependsOn` a persistent one.

### Remote caching
Vercel-hosted: `turbo login` then `turbo link`. Self-hosted: any HTTP-compatible store works (open-source servers exist) — set `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`. CI typically sets these as secrets.

### Filtering
- `--filter=web` — by package name
- `--filter=./apps/*` — by path glob
- `--filter=...web` — `web` and its dependencies
- `--filter=web...` — `web` and its dependents
- `--filter=[main]` — packages changed since `main`
- Combine: `--filter=...[origin/main]^` for "everything affected since main, plus deps"

### Pruning for Docker
`turbo prune <pkg>` produces a minimal subset of the workspace with only what's needed to build `<pkg>` — used in multi-stage Dockerfiles to keep image build context small.

## Common pitfalls

- **Forgetting `outputs`** — if outputs aren't declared, cache restoration produces nothing on the next run. Empty `outputs: []` is valid for lint/test (logs are still cached).
- **`outputs` with `!` negation** — order doesn't matter, but negations must reference paths included by an earlier pattern. Useful for `".next/**", "!.next/cache/**"`.
- **`globalDependencies`** — files like `tsconfig.base.json` or `.env` that affect every task. List them at the top level to invalidate everything when they change.
- **Env var leakage** — any env var read by your build that's NOT in `env` or `globalEnv` won't invalidate the cache. Set `TURBO_PRINT_VERSION_DISABLED` or use `turbo run --dry=json` to inspect hashes.
- **Mixing package managers** — Turborepo reads the workspace from `pnpm-workspace.yaml`, `package.json#workspaces`, or `yarn workspaces`. Only one source of truth.
- **`turbo dev` blocking** — `dev` is persistent; running `turbo dev` from CI will hang. Guard with `--filter` and only run in real dev sessions.
- **Cache pollution from machine-specific paths** — if a build embeds absolute paths or timestamps, the cached output differs per machine. Strip timestamps, use relative paths.
- **`.gitignore` is not enough** — Turborepo respects `.gitignore` for `inputs`, but if you commit generated files (anti-pattern), they'll be hashed and cause unexpected misses.

## Reference

- Official docs: https://turborepo.com/docs
- `turbo.json` schema: https://turborepo.com/docs/reference/configuration
- Filtering syntax: https://turborepo.com/docs/reference/run#--filter-string
- Related: [[nx-monorepo]] (alternative with more features), [[pnpm-workspaces]] (common pairing)
