---
name: svelte-expert
description: Build Svelte 5 components and SvelteKit apps using runes ($state, $derived, $effect, $props), stores, actions, transitions, and file-based routing. Use when authoring .svelte or .svelte.ts files, migrating from legacy reactivity, or wiring +page/+server endpoints.
---

# Svelte 5 Expert

Svelte 5 replaces the magic `let`/`$:` reactivity of Svelte 3/4 with explicit **runes** -- compiler-recognized functions like `$state`, `$derived`, `$effect`, and `$props`. SvelteKit layers file-based routing, server endpoints, and form actions on top. This skill covers runes-first component authoring, store interop, and the core SvelteKit primitives.

## Use this skill when

- Authoring a `.svelte` component in a Svelte 5 project
- Migrating Svelte 3/4 reactive declarations to runes
- Designing component props with `$props()` and bindable values
- Adding a SvelteKit route, layout, or `+server.ts` endpoint
- Building custom actions (`use:action`) or transitions
- Sharing state across components (runes module or legacy store)

## Do not use this skill when

- The project is locked to Svelte 3/4 (different reactivity model)
- You need server framework guidance beyond SvelteKit basics
- The question is about a different framework

## Core concepts

- **Runes are compile-time**: `$state`, `$derived`, `$effect`, `$props`, `$bindable`, `$inspect` are recognized by the compiler -- do not import them. They only work inside `.svelte` and `.svelte.js`/`.svelte.ts` modules.
- **`$state(v)`**: deeply reactive proxy for objects/arrays; for primitives, just a tracked value. Assignment is the trigger: `count = count + 1`.
- **`$derived(expr)`**: pure, cached expression. Use `$derived.by(() => { ... })` for multi-statement derivations.
- **`$effect(fn)`**: runs after mount and whenever read deps change. Return a cleanup function. Avoid for derived state -- use `$derived`.
- **`$props()`**: replaces `export let`. Destructure with defaults and rest: `let { name = 'world', ...rest } = $props()`. Mark two-way props with `$bindable()`.
- **Stores still work**: `writable`/`readable` from `svelte/store` are valid; access with `$store` auto-subscription. Prefer runes for new code, stores for cross-module singletons or legacy interop.
- **SvelteKit routing**: filesystem under `src/routes/`. `+page.svelte` renders a page, `+page.ts`/`+page.server.ts` loads data, `+server.ts` exposes HTTP handlers, `+layout.svelte` wraps children.

## Quick start

```svelte
<!-- src/routes/counter/+page.svelte -->
<script lang="ts">
  let { initial = 0 }: { initial?: number } = $props()
  let count = $state(initial)
  let doubled = $derived(count * 2)

  $effect(() => {
    document.title = `Count: ${count}`
  })
</script>

<button onclick={() => count++}>{count} (x2 = {doubled})</button>
```

```ts
// src/routes/api/items/+server.ts
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q') ?? ''
  return json({ q, results: [] })
}
```

```ts
// src/lib/cart.svelte.ts -- shared reactive module
export const cart = $state({ items: [] as { id: string; qty: number }[] })
export function add(id: string) {
  const row = cart.items.find((i) => i.id === id)
  row ? row.qty++ : cart.items.push({ id, qty: 1 })
}
```

## Key patterns

- **Bindable props**: `let { value = $bindable() } = $props()` lets the parent write `<Input bind:value={name} />`. Without `$bindable`, props are one-way.
- **Snippets replace slots**: `{#snippet row(item)}...{/snippet}` plus `{@render row(x)}`. Children default to a `children` prop: `{@render children?.()}`.
- **Actions**: `function tooltip(node: HTMLElement, text: string) { ... return { update, destroy } }` then `<button use:tooltip={'hi'}>`. Great for imperative DOM glue (focus, intersection observers).
- **Transitions**: `import { fade, fly } from 'svelte/transition'`; apply with `transition:fade`, `in:fly`, `out:fly`. Use `|local` to avoid playing on parent mounts.
- **Load functions**: `+page.ts` runs on server then client (universal); `+page.server.ts` runs only on the server (use for DB calls, secrets). Returned data is the page's `data` prop.
- **Form actions**: `+page.server.ts` exports `actions = { default: async ({ request }) => { ... } }`; the page submits with `<form method="POST">`. Use progressive enhancement via `use:enhance`.

## Common pitfalls

- **Reassigning a `$state` object loses identity for consumers that hold the old reference**. Mutate properties (`state.items.push(x)`) or have consumers always read through the same module-level binding.
- **`$effect` for derived values causes loops**. If the result is a pure function of inputs, use `$derived`. `$effect` is for side effects (DOM, network, logs).
- **Forgetting that runes are scoped to `.svelte`/`.svelte.ts`**. A plain `.ts` file cannot use `$state`; rename to `.svelte.ts`.
- **Old `export let` syntax in a runes component triggers warnings**. Pick one mode per component; mixed mode is allowed only during migration.
- **`$:` reactive blocks are legacy** and disabled when any rune is used in the file. Convert to `$derived` or `$effect`.
- **`+page.server.ts` data must be serializable** (JSON-safe). Functions, Dates without `devalue` handling, and class instances will fail or lose identity.
- **`load` runs on both server and client by default** (`+page.ts`). Don't reference `window` without guarding via `browser` from `$app/environment`.

## Reference

- Svelte 5 docs: https://svelte.dev/docs/svelte/
- Runes overview: https://svelte.dev/docs/svelte/what-are-runes
- SvelteKit: https://svelte.dev/docs/kit/
- Migration guide (4 to 5): https://svelte.dev/docs/svelte/v5-migration-guide
