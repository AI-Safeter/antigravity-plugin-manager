---
name: astro-static-sites
description: Build content-heavy sites with Astro v4+ using islands architecture, content collections, and selective hydration. Use when scaffolding marketing pages, blogs, or docs that ship minimal JS, mixing React/Vue/Svelte components, or choosing between prerendering and SSR.
---

# Astro Static Sites

Astro renders to static HTML by default and only hydrates the JavaScript you explicitly opt in to via **island directives** (`client:load`, `client:idle`, `client:visible`, `client:media`, `client:only`). Content collections give typed access to Markdown/MDX, and integrations let you drop React/Vue/Svelte/Solid components into the same project. This skill covers the page model, islands, collections, and the prerender-vs-SSR decision.

## Use this skill when

- Building a marketing site, docs site, or blog where JS should be minimal
- Adding interactive widgets (React/Vue/Svelte) inside otherwise static pages
- Authoring content in Markdown/MDX with frontmatter validation
- Choosing per-route between static prerender and SSR (hybrid output)
- Wiring View Transitions for SPA-like navigation
- Integrating Tailwind, sitemap, image optimization, or a CMS

## Do not use this skill when

- The app is a heavily interactive SPA (use a framework's own router)
- You need real-time bidirectional features that demand a custom server stack
- The project is on Astro v2/v3 (some APIs differ -- check version first)

## Core concepts

- **`.astro` components**: server-only by default. Frontmatter (`---`) runs at build time (or per-request in SSR). Templates use JSX-like syntax with full HTML escape hatches.
- **Islands**: any framework component (`<Counter client:visible />`) becomes an interactive island. Astro ships only that island's JS; the rest stays static HTML.
- **Client directives**:
  - `client:load` -- hydrate on page load
  - `client:idle` -- hydrate during `requestIdleCallback`
  - `client:visible` -- hydrate when scrolled into view (intersection observer)
  - `client:media="(min-width: 768px)"` -- hydrate when media query matches
  - `client:only="react"` -- skip SSR, render only on client (for browser-only libs)
- **Content collections**: typed Markdown/MDX in `src/content/<collection>/`. Define schema in `src/content.config.ts` with Zod; query via `getCollection('blog')` and `getEntry()`.
- **Output modes**: `output: 'static'` (all prerendered), `output: 'server'` (all SSR), or hybrid via per-page `export const prerender = true/false`. SSR needs an adapter (`@astrojs/node`, `@astrojs/vercel`, etc.).

## Quick start

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'

export default defineConfig({
  integrations: [react(), mdx()],
  output: 'static',
})
```

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
})

export const collections = { blog }
```

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry } from 'astro:content'
import Counter from '../../components/Counter.tsx'

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return posts.map((p) => ({ params: { slug: p.slug }, props: { post: p } }))
}

const { post } = Astro.props
const { Content } = await post.render()
---
<article>
  <h1>{post.data.title}</h1>
  <Content />
  <Counter client:visible />
</article>
```

## Key patterns

- **Pick the lightest directive that works**: prefer `client:visible` over `client:load` for below-the-fold widgets; `client:idle` for non-critical above-the-fold.
- **`client:only` for browser-only libs**: components that touch `window` during render (charts, maps) need `client:only="react"` to skip SSR.
- **View Transitions**: add `<ClientRouter />` from `astro:transitions` in your layout for cross-page animations and persistent elements via `transition:name` and `transition:persist`.
- **Server endpoints**: `src/pages/api/foo.ts` exporting `GET`/`POST` functions returns JSON or Response objects. Static by default; mark `export const prerender = false` to make per-request.
- **Image optimization**: import images and use `<Image src={img} alt="..." />` from `astro:assets` for automatic resizing, format conversion, and lazy loading.
- **Per-page prerender override**: in a `server`-output project, opt a route into static with `export const prerender = true` in the frontmatter. Inverse works for `static`-output projects on Astro 5.

## Common pitfalls

- **Passing functions or class instances as props to islands**: only JSON-serializable props cross the server/client boundary. Use data plus client-side wiring instead.
- **Importing a React component without `client:*`**: it renders as static HTML with no event handlers attached. Easy to miss because it looks correct visually.
- **Multiple islands sharing state**: each island is its own root. Use a shared store (nanostores, Zustand) loaded inside both, or lift state into the URL.
- **Forgetting Zod schema updates**: changing collection frontmatter without updating the schema produces silent type drift; run `astro sync` (or `astro check`) after schema changes.
- **`client:only` without specifying the framework**: `client:only` alone falls back to a placeholder. Always pass `client:only="react"` (or vue/svelte/solid).
- **Mixing `output: 'static'` with API routes that need request context**: those routes must opt out of prerendering or the build will inline a stale response.

## Reference

- Astro docs: https://docs.astro.build/
- Islands architecture: https://docs.astro.build/en/concepts/islands/
- Content collections: https://docs.astro.build/en/guides/content-collections/
- View Transitions: https://docs.astro.build/en/guides/view-transitions/
- Adapters / SSR: https://docs.astro.build/en/guides/server-side-rendering/
