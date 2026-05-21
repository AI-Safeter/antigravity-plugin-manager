---
name: esbuild-bundler
description: 'esbuild for extremely fast JS/TS bundling and transpilation. Use this skill when bundling Node libraries, building CLI tools, transpiling TS/JSX without typechecking, replacing babel/tsc for speed, writing esbuild plugins, configuring the JS or Go API, setting up watch mode, or producing ESM/CJS/IIFE outputs. Triggers: esbuild, esbuild.build, esbuild plugin, tsup, bundle TypeScript fast, transpile TSX, replace babel, replace tsc, esbuild loader, jsx factory, esbuild watch.'
---

# esbuild

esbuild is a JS/TS bundler and minifier written in Go. It is 10 to 100 times faster than Webpack/Rollup/Parcel for typical projects because it parses, links, and prints in parallel with zero JS overhead. It is the engine behind Vite's dev server, tsup, and many other tools. Use esbuild directly when you need raw speed and don't need plugin ecosystems as rich as Rollup's.

## Use this skill when

- Bundling a Node.js library, CLI, or server (especially with `--platform=node`)
- Transpiling TypeScript/JSX as a babel/tsc replacement (no typechecking — run `tsc --noEmit` separately)
- Building serverless function bundles where cold-start size matters
- Writing a one-off build script that wraps esbuild's JS API
- Authoring a custom esbuild plugin via `onResolve`/`onLoad`
- Embedding bundling inside another Node tool

## Do not use this skill when

- You need a full-featured browser app build with rich plugin needs (use Vite, which wraps esbuild + Rollup)
- You need strict typechecking as part of the build (esbuild does not typecheck — pair with `tsc --noEmit`)
- You need advanced tree-shaking guarantees (Rollup is stricter)

## Core concepts

esbuild is fast because (1) it's written in Go and uses all CPU cores, (2) the AST is shared between parser/linker/printer instead of being walked multiple times, and (3) it avoids the overhead of running in a JS VM. It deliberately keeps its scope small: no typechecking, no HMR, no built-in CSS framework support. It does TS/JSX, JSON, CSS (basic), minification, source maps, and code splitting for ESM output only.

## Quick start

```bash
npm install --save-dev esbuild
```

CLI:

```bash
npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile=dist/index.js \
  --sourcemap
```

JS API (`build.mjs`):

```js
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true,
  external: ['fsevents'],
})
```

## Key patterns

### Watch / rebuild mode
Use the `context` API (v0.17+) instead of the deprecated `watch: true` option:
```js
import { context } from 'esbuild'
const ctx = await context({ /* options */ })
await ctx.watch()
// or one-shot: await ctx.rebuild()
```

### Platform and format
- `--platform=browser` (default): assumes browser globals, bundles deps.
- `--platform=node`: keeps Node built-ins external, uses Node's resolution.
- `--platform=neutral`: no assumptions, you control `mainFields`/`conditions`.
- `--format=esm | cjs | iife`. ESM is required for code splitting and top-level await.

### External dependencies
Mark deps as external to avoid bundling (essential for Node libraries):
```js
external: ['react', 'react-dom']        // exact
external: ['*.png']                     // pattern (CLI: --external:*.png)
```
For Node CLIs, mark `dependencies` external and let the consumer's `node_modules` resolve them; bundle only `devDependencies` you actually inline.

### Loaders
Built-in: `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.css`, `.txt`, `.binary`, `.base64`, `.dataurl`, `.file`, `.copy`, `.empty`. Configure per extension:
```js
loader: { '.png': 'file', '.svg': 'text' }
```

### Define / inject
Compile-time substitutions:
```js
define: { 'process.env.NODE_ENV': '"production"', '__DEV__': 'false' }
```
String values must be JSON-encoded (the literal quotes matter — `"production"` not `production`).

### Plugins
A plugin is `{ name, setup(build) }`. Use `onResolve` to remap paths, `onLoad` to provide contents:
```js
const envPlugin = {
  name: 'env',
  setup(build) {
    build.onResolve({ filter: /^env$/ }, args => ({ path: args.path, namespace: 'env-ns' }))
    build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
      contents: JSON.stringify(process.env), loader: 'json',
    }))
  },
}
```

### Code splitting
Only works with `format: 'esm'` and requires `splitting: true` + `outdir` (not `outfile`):
```js
{ entryPoints: ['a.ts', 'b.ts'], bundle: true, splitting: true, format: 'esm', outdir: 'dist' }
```

## Common pitfalls

- **No typechecking** — esbuild strips types but never errors on type mismatches. Always run `tsc --noEmit` in CI.
- **No `experimentalDecorators` legacy support without `tsconfig.json`** — esbuild reads `tsconfig.json` for `target`, `useDefineForClassFields`, `experimentalDecorators`, `jsxFactory`, `paths`. Make sure it's discoverable.
- **`paths` aliases need help** — esbuild honors `tsconfig.json` `paths` only when bundling. For non-bundle transpile, paths are ignored.
- **`__dirname` in ESM Node output** — esbuild leaves it as-is in ESM; it does not exist in real ESM. Use `banner: { js: "import {fileURLToPath} from 'url'; const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);" }` or switch to `format: 'cjs'`.
- **`.cjs` vs `.mjs` output extension** — set `outExtension: { '.js': '.mjs' }` if your consumer expects ESM by extension.
- **CSS bundling is basic** — esbuild handles `@import` and asset URLs but has no PostCSS / Tailwind / CSS modules out of the box. Use a plugin or pre-process.
- **Tree-shaking is conservative on CJS** — wrap CJS deps with care, or mark them external.
- **Source map size** — `sourcemap: 'linked'` (default) emits a `.map` file; `'inline'` embeds (huge); `'external'` emits with no `//# sourceMappingURL` comment.

## Reference

- Official docs: https://esbuild.github.io/
- API reference: https://esbuild.github.io/api/
- Plugin authoring: https://esbuild.github.io/plugins/
- Related: [[vite-build-tool]] (uses esbuild for dev + dep pre-bundling), [[webpack-config]] (the slower predecessor)
