---
name: storybook-component-docs
description: 'Storybook 8+ for component development and documentation. Use this skill when authoring stories in CSF 3.0, configuring args and controls, adding decorators, writing interaction tests with play functions, integrating addons (a11y, viewport, interactions, themes), composing MDX docs pages, or deploying a static Storybook. Triggers: storybook, stories.ts, stories.tsx, CSF, args, argTypes, play function, addon-a11y, addon-interactions, chromatic.'
---

# Storybook 8+ Component Docs

Storybook is the workshop for UI components: render each component in isolation, vary its inputs through args/controls, document behavior with MDX, and run interaction tests with Vitest-style assertions. Storybook 8 standardized on CSF 3.0 (object-form stories), Vite as the default builder, and a faster test runner powered by Vitest.

## Use this skill when
- Bootstrapping Storybook in a React/Vue/Svelte/Angular/Web Components project
- Migrating CSF 2.0 (function form) stories to CSF 3.0 (object form)
- Defining `args`, `argTypes`, and `parameters` for controls and docs
- Writing `play` functions for interaction tests
- Adding the `a11y`, `viewport`, `interactions`, `themes`, or `actions` addons
- Authoring MDX docs pages that mix prose and live stories
- Deploying static Storybook builds to Chromatic, Vercel, or S3

## Do not use this skill when
- You need full end-to-end tests across pages -- use Playwright/Cypress
- The project has one or two components and a README would suffice
- You only need design specs without code -- Figma may be enough

## Core concepts
A story is a single render of a component with a specific set of inputs. CSF 3.0 expresses stories as plain objects on a default-exported `Meta`. Args are the inputs Storybook passes to your component; argTypes describe their UI controls and docs. Decorators wrap every story (theme provider, router). Play functions run after render to interact with and assert against the DOM.

## Quick start
```ts
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Click me", variant: "primary" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost"] },
    onClick: { action: "clicked" },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };

export const ClickIncrements: Story = {
  args: { variant: "primary" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /click me/i });
    await userEvent.click(btn);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```

## Key patterns

### CSF 3.0
- Default export is a `Meta` object: `title`, `component`, `args`, `argTypes`, `parameters`, `decorators`, `tags`.
- Named exports are stories typed as `StoryObj<typeof Component>`.
- A story is just `{ args, play, parameters, decorators }`; an empty `{}` reuses the meta args.
- `tags: ["autodocs"]` on the meta auto-generates a Docs page; per-story `tags: ["!autodocs"]` excludes a story.

### Args and controls
- `args` are the component props for that story; Storybook renders inputs that mutate them at runtime.
- `argTypes` customize the control type: `"text"`, `"number"`, `"boolean"`, `"select"`, `"radio"`, `"color"`, `"date"`, or `{ type: "range", min, max, step }`.
- Use `action: "onClick"` to log calls to the Actions panel (or pass `fn()` from `@storybook/test` for assertions).
- Group controls with `argTypes: { size: { table: { category: "Layout" } } }`.

### Decorators
- Wrap stories in providers, routers, themes:
```tsx
decorators: [
  (Story) => (
    <ThemeProvider theme={dark}>
      <div style={{ padding: 16 }}><Story /></div>
    </ThemeProvider>
  ),
],
```
- Decorators can be set at the meta level or per story; per-story overrides meta.
- Global decorators live in `.storybook/preview.ts` and apply to every story.

### Parameters
- `parameters: { backgrounds: { default: "dark" } }` switches the canvas background.
- `parameters: { viewport: { defaultViewport: "iphone14" } }` from `addon-viewport`.
- `parameters: { layout: "centered" | "fullscreen" | "padded" }` controls canvas layout.
- Story-level `parameters` deep-merges with meta-level.

### Play functions and interaction tests
- Import from `@storybook/test` (Storybook 8): `within`, `userEvent`, `expect`, `fn`, `waitFor`.
- `play` receives `{ canvasElement, args, step }`; use `within(canvasElement)` to query like Testing Library.
- Use `step("opens menu", async () => { ... })` to label timeline events in the Interactions panel.
- Mock callbacks with `args: { onClick: fn() }` then assert `await expect(args.onClick).toHaveBeenCalled()`.
- Run all play tests headlessly: `test-storybook` (CLI) or `vitest --workspace` with the Vitest addon.

### Essential addons
- `@storybook/addon-essentials` ships Controls, Actions, Viewport, Backgrounds, Docs, Toolbars, Measure, Outline.
- `@storybook/addon-a11y` runs axe-core in the Accessibility panel; surfaces WCAG violations per story.
- `@storybook/addon-interactions` records play steps and gives time-travel debugging.
- `@storybook/addon-themes` toggles light/dark or any class-based theme via a toolbar control.
- `@storybook/addon-coverage` collects code coverage from the test runner.

### MDX docs
- Create `Button.mdx` next to `Button.stories.tsx`:
```mdx
import { Meta, Story, Controls, Canvas } from "@storybook/blocks";
import * as ButtonStories from "./Button.stories";

<Meta of={ButtonStories} />

# Button

Use buttons to trigger actions.

<Canvas of={ButtonStories.Primary} />
<Controls />
```
- The `of={...}` pattern (Storybook 7+) replaces the old `<Meta title=... />` magic.
- Mix prose, code, and live story embeds; useful for design-system documentation sites.

### Deployment
- `npm run build-storybook` outputs static assets to `storybook-static/`.
- Host on Chromatic for visual regression + PR review; or any static host (Vercel, Netlify, S3, GitHub Pages).
- Use `--test` to build a leaner version for the test runner: `build-storybook --test`.

## Common pitfalls
- CSF 2.0 function-form stories still parse but break some new addons; migrate with `npx storybook@latest migrate csf-2-to-3 --glob="**/*.stories.tsx"`.
- Forgetting `tags: ["autodocs"]` -- no Docs page is generated, just the Canvas tab.
- Importing testing utilities from `@testing-library/react` instead of `@storybook/test`; the Storybook version is preconfigured and works in the browser.
- Decorators allocated inline each render cause unnecessary remounts; define them at module scope.
- Args that are functions (`onClick: () => {}`) hide the action; use `fn()` from `@storybook/test` or `argTypes.onClick = { action: "onClick" }`.
- Story files in non-`stories.{js,ts,tsx,mdx}` patterns are ignored; check `main.ts`'s `stories` glob.
- Stale builder cache: delete `node_modules/.cache/storybook` if changes don't appear.
- Heavy global decorators that mount routers or data clients per story slow HMR -- scope them per story instead.

## Reference
- Official docs: https://storybook.js.org/docs
- CSF spec: https://storybook.js.org/docs/api/csf
- Storybook 8 release notes: https://storybook.js.org/blog/storybook-8/
- Related: [[react-fullstack]], [[mdx-content]], [[chromatic-visual-testing]]
