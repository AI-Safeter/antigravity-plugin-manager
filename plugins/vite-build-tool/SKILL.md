---
name: vite-build-tool
description: 'Vite build tool for fast development servers and optimized production builds. Use this skill when scaffolding a React, Vue, Svelte, Solid, Preact, or vanilla TS/JS project, configuring vite.config.ts, setting up dev/build/preview scripts, defining plugins, handling env vars (import.meta.env, VITE_ prefix), troubleshooting HMR, dep pre-bundling, asset imports, SSR mode, or library mode. Triggers: vite, vite.config, HMR, esbuild dev, rollup build, import.meta.env, vite plugin, vite-plugin-react, vite preview, vite dev server.'
---

# Vite

Vite is a frontend build tool that uses native ESM and esbuild for an instant dev server with HMR, and Rollup for the production build. It replaces Webpack/Parcel/CRA in modern frontend projects and is the default scaffold behind frameworks like SvelteKit, Nuxt, Astro, Remix (in part), and Vue's official toolchain.

## Use this skill when

- Scaffolding a new React, Vue, Svelte, Solid, Preact, Lit, or vanilla TS/JS project
- Editing `vite.config.ts` (or `.js`/`.mjs`) — plugins, aliases, server.proxy, build.rollupOptions
- Wiring env vars with the `VITE_` prefix and `import.meta.env`
- Diagnosing HMR breakage, slow cold start, or dep-pre-bundling misses
- Configuring SSR (`ssr` build option) or library mode (`build.lib`)
- Migrating from Create React App, Webpack, or Parcel

## Do not use this skill when

- You need a fully framework-managed build (use Next.js/Nuxt/SvelteKit guidance instead)
- You are bundling a Node.js server library where esbuild or tsup is a better fit
- You're working in a non-bundled native-ESM Deno/Bun-only environment

## Core concepts

Vite serves source files over native ESM during development — the browser requests modules and Vite transforms them on demand, so cold start is near-instant regardless of project size. For production it switches to Rollup, which does tree-shaking and code-splitting. Dependencies in `node_modules` are pre-bundled by esbuild on first run and cached in `node_modules/.vite`.

## Quick start

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # outputs dist/
npm run preview  # serves dist/ for smoke-testing
```

Minimal `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  resolve: { alias: { '@': '/src' } },
})
```

## Key patterns

### Env vars
Only variables prefixed with `VITE_` are exposed to client code via `import.meta.env.VITE_FOO`. Define them in `.env`, `.env.local`, `.env.development`, `.env.production`. Never put secrets in `VITE_*` — they ship to the browser. Built-ins: `import.meta.env.MODE`, `DEV`, `PROD`, `BASE_URL`.

### Path aliases
Set `resolve.alias` in `vite.config.ts` AND mirror in `tsconfig.json` `compilerOptions.paths` so the TS language server agrees. Common pitfall: aliases work at runtime but TS errors — always update both.

### Dev proxy
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') }
  }
}
```
Use this to avoid CORS in dev without touching the backend.

### Code splitting
Dynamic `import()` is automatically split into a separate chunk. Tune with `build.rollupOptions.output.manualChunks` for vendor splitting:
```ts
build: {
  rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'] } } }
}
```

### Library mode
For publishing a package:
```ts
build: {
  lib: { entry: 'src/index.ts', formats: ['es', 'cjs'], fileName: 'my-lib' },
  rollupOptions: { external: ['react', 'react-dom'] }
}
```

### Static assets
Import returns a URL string: `import logo from './logo.svg'`. For inlining small assets adjust `build.assetsInlineLimit` (default 4096 bytes). For raw text use `?raw`; for URLs use `?url`; for workers use `?worker`.

## Common pitfalls

- **`process.env` does not exist in client code** — use `import.meta.env`. If a library expects `process.env.NODE_ENV`, add `define: { 'process.env.NODE_ENV': JSON.stringify(mode) }`.
- **Dep pre-bundle stale cache** — after switching branches or upgrading deps, delete `node_modules/.vite` or run with `--force`.
- **CommonJS-only deps** — Vite handles most via pre-bundling, but some packages need `optimizeDeps.include: ['pkg']` to be forced through esbuild.
- **Absolute imports from `/`** — Vite treats `/foo` as `<root>/foo` from the project root, not from `src/`. Use the `@` alias for in-source paths.
- **Public dir vs imports** — files in `public/` are copied verbatim and referenced by absolute path; imported assets get hashed filenames. Don't import from `public/`.
- **`base` option for subpath deploys** — if hosting under `/app/`, set `base: '/app/'` or assets will 404.
- **Top-level await in deps** — supported in modern targets only; check `build.target` (default `modules` → ES2020+).

## Reference

- Official docs: https://vite.dev/
- Plugin list: https://github.com/vitejs/awesome-vite
- Related: [[esbuild-bundler]] (Vite's dev engine), [[webpack-config]] (the predecessor it replaces)
