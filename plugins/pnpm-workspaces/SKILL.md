---
name: pnpm-workspaces
description: 'pnpm package manager with content-addressable store, strict node_modules layout, and workspaces for monorepos. Use this skill when installing/upgrading deps, authoring pnpm-workspace.yaml, configuring .npmrc, using pnpm filters, handling peer dependencies, fixing phantom-dependency issues, working with the lockfile, or setting up CI caching. Triggers: pnpm, pnpm install, pnpm-workspace.yaml, pnpm-lock.yaml, .npmrc, hoist-pattern, shamefully-hoist, pnpm filter, pnpm add, content-addressable store, phantom dependency, peer dependency warnings.'
---

# pnpm

pnpm is a fast, disk-efficient Node package manager. It stores every version of every package once in a content-addressable global store (`~/.local/share/pnpm/store`) and uses hard links + symlinks to materialize `node_modules`. The result: 10x less disk usage, faster installs after the first, and a strict `node_modules` layout that surfaces phantom dependencies that npm/yarn classic hide. pnpm workspaces are the idiomatic way to manage JS monorepos.

## Use this skill when

- Initializing a project with `pnpm init` or migrating from npm/yarn
- Authoring `pnpm-workspace.yaml` for a monorepo
- Configuring `.npmrc` (hoisting, peer deps, registry auth, side-effects cache)
- Using filters: `pnpm --filter <pkg> add <dep>`, `pnpm -r run build`
- Diagnosing peer dependency warnings or `ERR_PNPM_PEER_DEP_ISSUES`
- Pinning the package manager version with `packageManager` in `package.json` and Corepack
- Setting up CI cache for `~/.local/share/pnpm/store`

## Do not use this skill when

- The project already uses npm or yarn and there's no compelling reason to switch
- You're targeting an environment where strict symlinks break (some bundlers, some serverless runtimes — verify first)

## Core concepts

pnpm's `node_modules` is **not flat**. Top-level `node_modules` contains only the packages your `package.json` declares; the rest live under `node_modules/.pnpm/<name>@<version>/node_modules/`. This prevents "phantom dependencies" — code that imports a package not listed in its own `package.json` simply fails, as it should. The global content-addressable store means installing the same package version in 100 projects costs the disk of installing it once.

## Quick start

```bash
# Install via Corepack (recommended)
corepack enable
corepack prepare pnpm@latest --activate

# New project
pnpm init
pnpm add react react-dom
pnpm add -D typescript

# Monorepo
echo "packages:\n  - 'apps/*'\n  - 'packages/*'" > pnpm-workspace.yaml
pnpm install
```

`package.json` should pin the package manager:

```json
{ "packageManager": "pnpm@9.12.0" }
```

## Key patterns

### Workspaces and filtering
`pnpm-workspace.yaml` lists glob patterns. Reference workspace packages with the `workspace:` protocol:
```json
"dependencies": { "@my/utils": "workspace:*" }
```
Run commands across workspaces:
```bash
pnpm -r run build                   # recursive, all workspaces
pnpm --filter web run dev           # one package
pnpm --filter "./apps/*" run test   # path glob
pnpm --filter "...web" run build    # web + dependencies
pnpm --filter "web..." run build    # web + dependents
pnpm --filter "[origin/main]" build # affected since main
```

### `.npmrc` settings to know
- `auto-install-peers=true` (default in pnpm 8+) — auto-install missing peers.
- `strict-peer-dependencies=false` — downgrade peer issues to warnings (default false; flip to true for strictness).
- `shamefully-hoist=true` — hoist all deps to root `node_modules` (escape hatch for tools that can't handle strict layout; avoid if possible).
- `public-hoist-pattern[]=*types*` — selectively hoist (e.g. types packages).
- `node-linker=hoisted | isolated | pnp` — `isolated` is default; `hoisted` mimics npm; `pnp` uses Yarn-PnP-style resolution.
- `dedupe-peer-dependents=true` — deduplicate peers (default true in recent versions).

### Adding deps in monorepos
```bash
pnpm add lodash --filter web              # add to one workspace
pnpm add -D typescript -w                 # add to root
pnpm add @my/utils --filter web --workspace  # link a workspace pkg
```

### Lockfile
`pnpm-lock.yaml` is the single source of truth. Commit it. `pnpm install --frozen-lockfile` is the CI mode — fails if lockfile is out of date. `pnpm install --no-frozen-lockfile` updates it.

### Overrides and patches
Force a transitive version in root `package.json`:
```json
"pnpm": {
  "overrides": { "lodash": "^4.17.21" },
  "peerDependencyRules": { "ignoreMissing": ["@babel/core"] }
}
```
Patch a dependency: `pnpm patch <pkg>` opens an editable copy; `pnpm patch-commit <dir>` saves a `.patches` file.

### CI caching
Cache the store, not `node_modules`:
```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with: { cache: 'pnpm' }   # caches the pnpm store automatically
- run: pnpm install --frozen-lockfile
```

## Common pitfalls

- **Tool can't find a package that "should be there"** — the package is a transitive dep, not a direct one. Fix: `pnpm add <pkg>` to make it a real dependency (this is pnpm doing its job).
- **`shamefully-hoist=true` as default fix** — masks real bugs and forfeits pnpm's main benefit. Use it only for known-broken tools and prefer `public-hoist-pattern[]` for surgical hoisting.
- **Peer dep warnings flood the console** — usually solvable with `peerDependencyRules.allowedVersions` or by upgrading the package that's stuck on an old peer.
- **`workspace:*` published to npm verbatim** — pnpm publish replaces `workspace:*` with the actual resolved version. If you bypass `pnpm publish` (e.g. publishing a tarball manually), the protocol leaks.
- **Symlink-incompatible runtimes** — some serverless bundlers (older Lambda layers, certain Docker scratch images) misbehave with symlinks. Use `node-linker=hoisted` for those targets, or bundle the app first.
- **Corepack drift** — without `packageManager` pinned in `package.json`, contributors run different pnpm versions and the lockfile churns. Always pin.
- **`pnpm dlx` vs `pnpm exec`** — `dlx` downloads and runs (like `npx`); `exec` runs a locally installed binary. Mixing them up causes "command not found" or unexpected version use.
- **Patch files break on upgrade** — `pnpm patch` produces a diff against a specific version. Upgrading the underlying package may make the patch fail to apply; expect to refresh patches on major version bumps.

## Reference

- Official docs: https://pnpm.io/
- Workspace docs: https://pnpm.io/workspaces
- `.npmrc` settings: https://pnpm.io/npmrc
- Related: [[turborepo-monorepo]], [[nx-monorepo]] (both pair naturally with pnpm)
