---
name: webpack-config
description: 'Webpack 5 configuration including entry/output, loaders, plugins, code-splitting, module federation, asset modules, tree-shaking, source maps, and dev server. Use this skill when editing webpack.config.js, debugging bundle size or build errors, configuring babel-loader/ts-loader/css-loader, setting up SplitChunksPlugin, MiniCssExtractPlugin, HtmlWebpackPlugin, DefinePlugin, or migrating from Webpack 4. Triggers: webpack, webpack.config, webpack-dev-server, module federation, splitChunks, optimization.minimize, HMR webpack, babel-loader, ts-loader, css-loader, MiniCssExtractPlugin, asset modules.'
---

# Webpack 5

Webpack is a module bundler that builds a dependency graph from entry points and emits one or more bundles. Webpack 5 introduced persistent caching, asset modules, module federation, and improved tree-shaking. It remains the standard for complex enterprise frontends, micro-frontend architectures, and projects with non-trivial loader chains. New greenfield projects often prefer Vite or esbuild, but Webpack is still ubiquitous in existing codebases.

## Use this skill when

- Editing `webpack.config.js` (or `.ts`/`.mjs`) — entry, output, module.rules, plugins, optimization
- Configuring loaders for TS/Babel/CSS/Sass/PostCSS/SVG/images
- Setting up code splitting via `SplitChunksPlugin` or dynamic `import()`
- Implementing Module Federation for micro-frontends
- Diagnosing slow builds, large bundles, or HMR breakage
- Upgrading from Webpack 4 to 5

## Do not use this skill when

- Starting a greenfield frontend project (prefer Vite or esbuild)
- Bundling a small Node.js library (use tsup or esbuild)
- The project uses a framework that hides Webpack (Next.js, CRA — extend via their config hooks instead)

## Core concepts

Webpack treats every file as a module. Loaders transform individual file types into JS modules; plugins hook into the broader compilation lifecycle. Webpack 5 added Asset Modules (`asset/resource`, `asset/inline`, `asset/source`, `asset/`) to replace `file-loader`, `url-loader`, and `raw-loader`. Persistent disk caching (`cache.type: 'filesystem'`) is the single biggest perf win and is off by default.

## Quick start

```bash
npm install --save-dev webpack webpack-cli webpack-dev-server \
  babel-loader @babel/core @babel/preset-env @babel/preset-react \
  html-webpack-plugin
```

Minimal `webpack.config.js`:

```js
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development', // or 'production'
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|jpg|svg)$/, type: 'asset' },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './src/index.html' })],
  cache: { type: 'filesystem' },
  devServer: { hot: true, port: 3000 },
}
```

## Key patterns

### Code splitting
Dynamic `import('./feature')` produces a separate chunk automatically. Tune vendor splitting:
```js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' },
    },
  },
}
```

### Asset modules (Webpack 5)
Replace `file-loader`/`url-loader`/`raw-loader`:
- `asset/resource` — emit a separate file (was `file-loader`)
- `asset/inline` — inline as data URI (was `url-loader`)
- `asset/source` — inline raw source string (was `raw-loader`)
- `asset` — auto-chooses inline vs resource based on `parser.dataUrlCondition.maxSize` (default 8 KiB)

### TypeScript
Two paths: `ts-loader` (strict typecheck during build) or `babel-loader` with `@babel/preset-typescript` (faster, no typecheck — run `tsc --noEmit` separately). Most teams prefer the babel + separate `tsc` approach for speed.

### CSS extraction (production)
```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
// rule: use: [MiniCssExtractPlugin.loader, 'css-loader']
// plugins: new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })
```
Use `style-loader` in dev for HMR, `MiniCssExtractPlugin.loader` in prod.

### DefinePlugin for compile-time constants
```js
new webpack.DefinePlugin({
  'process.env.API_URL': JSON.stringify(process.env.API_URL),
})
```
Values are textually substituted — always `JSON.stringify` strings.

### Module Federation
Webpack 5's flagship feature for micro-frontends. Host exposes/consumes remote modules at runtime:
```js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: { products: 'products@http://cdn/products/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

### Tree-shaking
Set `mode: 'production'` (enables `usedExports` and `minimize`). Mark packages as side-effect-free in `package.json`: `"sideEffects": false` or `"sideEffects": ["*.css"]`. CommonJS imports cannot be tree-shaken — prefer ESM throughout.

## Common pitfalls

- **Forgetting `cache: { type: 'filesystem' }`** — rebuilds re-do work that disk cache could skip. Often a 10x speedup.
- **`[hash]` vs `[contenthash]`** — `[hash]` changes with every build (bad for browser caching); use `[contenthash]` so unchanged chunks keep their filename.
- **CSS HMR with MiniCssExtractPlugin** — extracted CSS does not HMR cleanly. Use `style-loader` in dev, extract only in prod.
- **`source-map-loader` warnings spam** — third-party deps shipping bad source maps flood the console. Use `ignoreWarnings: [/Failed to parse source map/]`.
- **Mixing CJS and ESM in source** — breaks tree-shaking and can produce duplicate modules. Pick ESM throughout source code.
- **`devtool` cost** — `source-map` is the most accurate but slowest; `eval-cheap-module-source-map` is the standard dev choice. Production: `source-map` or `hidden-source-map` (upload to Sentry, don't ship).
- **Polyfills changed in v5** — Node core modules (`crypto`, `path`, `stream`) are no longer auto-polyfilled. Either install browserified versions and set `resolve.fallback`, or refactor to avoid them in browser code.
- **`__dirname` and `__filename`** behave differently in ESM config files — stick with `.cjs` extension for the config or compute paths from `import.meta.url`.

## Reference

- Official docs: https://webpack.js.org/
- Configuration reference: https://webpack.js.org/configuration/
- Module Federation: https://webpack.js.org/concepts/module-federation/
- Related: [[vite-build-tool]] (modern alternative), [[esbuild-bundler]] (used by some loaders internally)
