---
name: vue-pro
description: Build production Vue 3 apps with the Composition API, script setup, Pinia, and Vue Router. Use when writing or refactoring Vue single-file components, designing reactive state, wiring routes, or tuning render performance.
---

# Vue 3 Pro

Modern Vue 3 development centers on the Composition API with `<script setup>`, fine-grained reactivity via `ref`/`reactive`/`computed`, and Pinia for cross-component state. This skill covers SFC patterns, component contracts (props/emits/slots), routing, suspense for async setup, and the performance levers (`v-memo`, async components, `shallowRef`) that matter at scale.

## Use this skill when

- Writing or refactoring a Vue 3 single-file component
- Designing a Pinia store or migrating Vuex state
- Setting up Vue Router with nested or lazy routes
- Defining a component's public contract via `defineProps`, `defineEmits`, `defineExpose`
- Diagnosing re-render or reactivity bugs
- Loading async components or wrapping data fetches in `<Suspense>`

## Do not use this skill when

- The project is Vue 2 / Options API only (use a Vue 2 specific guide)
- You need Nuxt SSR/SSG specifics (use a Nuxt skill)
- The question is about a different framework (React, Svelte, etc.)

## Core concepts

- **Reactivity**: `ref(v)` wraps any value; `.value` in script, auto-unwrapped in template. `reactive(obj)` deep-proxies an object but loses reactivity on destructure. Prefer `ref` for primitives and most state; use `reactive` for stable, never-replaced objects.
- **Derivations**: `computed(() => ...)` is cached and re-runs only when tracked deps change. `watch(source, cb)` for explicit side effects with old/new values. `watchEffect(fn)` auto-tracks deps and runs immediately.
- **`<script setup>`**: top-level bindings are exposed to the template; no `return` needed. Compiler macros (`defineProps`, `defineEmits`, `defineModel`, `defineExpose`) are compile-time, not imports.
- **Pinia**: stores are composables. `defineStore('id', () => { ... })` (setup syntax) returns refs/computeds/actions. Stores hot-reload and devtool-introspect.
- **Vue Router 4**: `createRouter({ history: createWebHistory(), routes })`. Use `useRoute()` / `useRouter()` in setup.

## Quick start

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{ initial: number }>()
const emit = defineEmits<{ change: [value: number] }>()

const count = ref(props.initial)
const doubled = computed(() => count.value * 2)

watch(count, (n) => emit('change', n))

function inc() { count.value++ }
defineExpose({ reset: () => (count.value = props.initial) })
</script>

<template>
  <button @click="inc">{{ count }} (x2 = {{ doubled }})</button>
</template>
```

```ts
// stores/cart.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCart = defineStore('cart', () => {
  const items = ref<{ id: string; qty: number }[]>([])
  const total = computed(() => items.value.reduce((n, i) => n + i.qty, 0))
  function add(id: string) {
    const row = items.value.find((i) => i.id === id)
    row ? row.qty++ : items.value.push({ id, qty: 1 })
  }
  return { items, total, add }
})
```

## Key patterns

- **Typed props/emits**: use the generic form `defineProps<{...}>()` and `defineEmits<{ event: [args] }>()`; pair with `withDefaults(defineProps<...>(), {...})` for defaults.
- **`defineModel`** (Vue 3.4+): two-way binding without manual `update:modelValue` plumbing: `const value = defineModel<string>()`.
- **Slots and scoped slots**: declare in template with `<slot name="x" :item="row" />`; consumer reads `v-slot:x="{ item }"`. Use `useSlots()` to inspect at runtime.
- **Async setup + Suspense**: `async setup` is supported only when the component is rendered inside `<Suspense>`. Wrap data-loading boundaries; provide a `#fallback` slot.
- **Lazy routes / async components**: `component: () => import('./Page.vue')` in the router; `defineAsyncComponent(() => import('./Heavy.vue'))` for inline use. Pair with Vite code splitting.
- **`v-memo`**: cache subtree renders for very large lists: `<div v-memo="[item.id, item.selected]">`. Only when the list is hot and props are stable.

## Common pitfalls

- **Destructuring a `reactive`** breaks reactivity. Use `toRefs(state)` or keep the proxy intact. Same applies to destructuring a Pinia store; use `storeToRefs(store)` for refs and access actions directly.
- **Forgetting `.value`** in script while it works in template. TypeScript catches most of this; enable Volar / vue-tsc.
- **Mutating props** triggers warnings and won't propagate. Emit an event or use `defineModel`.
- **`watch` with `{ deep: true }` on huge objects** is expensive. Watch a `computed` that derives a smaller key, or use `watchEffect` with targeted reads.
- **`reactive(new Map())` / Sets**: collection reactivity works, but reassignment (`state = new Map()`) breaks the proxy. Use `ref` to hold the collection if you need to replace it.
- **Using `ref` on DOM elements**: declare `const el = ref<HTMLElement | null>(null)` and bind `ref="el"`; available after mount, not during setup.

## Reference

- Vue docs: https://vuejs.org/guide/
- Pinia: https://pinia.vuejs.org/
- Vue Router: https://router.vuejs.org/
- Performance: https://vuejs.org/guide/best-practices/performance.html
