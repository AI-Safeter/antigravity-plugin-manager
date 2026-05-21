---
name: mdx-content
description: 'MDX (Markdown + JSX) authoring and tooling. Use this skill when writing or fixing .mdx files, configuring remark/rehype plugins, wiring MDX into Next.js, Astro, or Docusaurus, defining MDXProvider component mappings, handling frontmatter, or debugging MDX v3 vs v2 compilation errors. Triggers: mdx, @mdx-js, remark, rehype, MDXProvider, next-mdx-remote, contentlayer, astro mdx, docusaurus.'
---

# MDX Content

MDX lets you import and use JSX components directly inside Markdown. It is the standard for component-rich docs sites, marketing pages with interactive demos, and product blogs that need React inline. MDX v3 (current) compiles to ESM and is stricter than v2 about HTML quirks; most upgrade pain comes from that strictness.

## Use this skill when
- Writing docs or blog posts that mix prose with React/Vue/Svelte components
- Configuring `remark` and `rehype` plugin pipelines (syntax highlighting, frontmatter, TOC)
- Setting up MDX in Next.js (App Router, `next-mdx-remote`, Contentlayer), Astro, or Docusaurus
- Mapping markdown elements to custom components via `MDXProvider` or `components` prop
- Diagnosing MDX v3 errors like "Could not parse expression with acorn" or "Unexpected character"

## Do not use this skill when
- Content is plain Markdown with no JSX -- use CommonMark/GFM and skip the build complexity
- You need WYSIWYG editing for non-technical authors (consider a CMS)
- Target runtime cannot execute JavaScript (use static Markdown)

## Core concepts
An `.mdx` file is parsed as Markdown until the parser sees JSX, an `import`, or an `export`. Those are parsed as JavaScript. The result is compiled to an ES module that exports a default component which renders the page. Plugins transform the syntax tree at two stages: `remark` operates on the markdown AST (mdast), `rehype` on the HTML AST (hast).

## Quick start
```mdx
---
title: Hello MDX
date: 2025-05-21
tags: [mdx, react]
---

import Chart from "../components/Chart";

# {frontmatter.title}

Plain markdown still works. **Bold**, `code`, [links](https://mdxjs.com).

<Chart data={[1, 2, 3, 5, 8]} height={240} />

> Components and markdown live side by side.
```

```js
// Next.js App Router: app/blog/[slug]/page.tsx
import { compileMDX } from "next-mdx-remote/rsc";
import Chart from "@/components/Chart";

const { content, frontmatter } = await compileMDX({
  source: rawMdx,
  components: { Chart },
  options: { parseFrontmatter: true },
});
```

## Key patterns

### Frontmatter
- Vanilla MDX does not parse YAML frontmatter; you need `remark-frontmatter` plus a reader (`gray-matter`, `next-mdx-remote`'s `parseFrontmatter: true`, or Contentlayer/Astro built-ins).
- Treat frontmatter as the typed contract for a content collection: title, slug, date, tags, draft.
- Astro and Docusaurus expose frontmatter as `frontmatter` automatically; Next.js requires explicit wiring.

### Component mapping
- `MDXProvider` (classic, client components) or the `components` prop (`@mdx-js/react`, `next-mdx-remote`) maps tag names to React components.
- Common overrides: `h1`, `h2`, `a`, `img`, `pre`, `code`, `blockquote`. Replace `a` to add `next/link` and `img` to add `next/image`.
- Custom shortcodes (e.g., `<Callout type="warn">`) live in the same map; import them or pass at compile time.

### remark plugins (markdown stage)
- `remark-gfm`: tables, strikethrough, task lists, autolinks. Almost always on.
- `remark-frontmatter` + `remark-mdx-frontmatter`: parse YAML and expose as exported `frontmatter`.
- `remark-toc`: insert a table of contents at a heading.
- `remark-math`: parse `$inline$` and `$$block$$` math; pair with `rehype-katex`.

### rehype plugins (HTML stage)
- `rehype-slug`: add `id` attributes to headings.
- `rehype-autolink-headings`: add anchor links to those ids.
- `rehype-pretty-code` or `rehype-shiki`: syntax highlighting at build time (Shiki, no client-side highlighter).
- `rehype-katex`: render math.
- `rehype-external-links`: add `target="_blank" rel="noopener"` to outbound links.

### Framework integration

Next.js (App Router):
```js
// next.config.mjs
import nextMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";

const withMDX = nextMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [[rehypePrettyCode, { theme: "github-dark" }]],
  },
});

export default withMDX({ pageExtensions: ["ts", "tsx", "md", "mdx"] });
```

Astro:
```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
export default defineConfig({ integrations: [mdx()] });
```

Docusaurus: MDX is built in; configure plugins via `presets[0][1].docs.remarkPlugins`.

### Imports and exports inside MDX
- `import Foo from "..."` and `export const meta = {...}` work at the top of any `.mdx`.
- You can export arbitrary values consumed by the page renderer (great for sidebars/metadata).
- Expressions in braces are JavaScript: `{2 + 2}`, `{frontmatter.title.toUpperCase()}`.

### Authoring discipline
- Keep MDX files short -- a long file is a sign the components should be extracted.
- Put complex JSX in `.tsx` and import a single component into MDX; this keeps content reviewable by non-devs.
- Lint with `remark-lint` or `eslint-plugin-mdx` to catch broken links and busted JSX early.

## Common pitfalls
- MDX v3 strictness: `<` in prose (e.g., `1 < 2`) is parsed as JSX. Escape as `1 \< 2` or wrap in backticks.
- Auto-linked URLs containing `{` or `}` break the parser; escape or wrap in backticks.
- HTML comments `<!-- -->` are not valid MDX; use `{/* ... */}` JSX comments.
- Indented code blocks (4-space) are unreliable in MDX; always use fenced code blocks.
- A component used but not imported renders as a literal HTML tag (lowercase) or errors (uppercase) -- always import or pass via `components`.
- Server Components vs Client Components in Next.js: interactive MDX components must be `"use client"`; otherwise event handlers do nothing.
- Plugin order matters: `rehype-slug` must run before `rehype-autolink-headings`.

## Reference
- Official docs: https://mdxjs.com/
- Next.js MDX guide: https://nextjs.org/docs/app/building-your-application/configuring/mdx
- Astro MDX: https://docs.astro.build/en/guides/integrations-guide/mdx/
- Related: [[nextjs-fullstack]], [[astro-static-sites]], [[markdown-authoring]]
