---
name: web-accessibility-wcag
description: Make web UIs conform to WCAG 2.2 AA using semantic HTML, correct ARIA, keyboard support, focus management, and sufficient color contrast. Use when reviewing components for a11y, fixing axe/Lighthouse findings, building forms or modals, or auditing keyboard navigation.
---

# Web Accessibility (WCAG 2.2)

WCAG 2.2 organizes accessibility around four **POUR** principles: Perceivable, Operable, Understandable, Robust. The single most leveraged rule is "use the right HTML element"; ARIA only fills the gaps where native semantics fall short. This skill covers the AA-level requirements developers hit most often -- semantic structure, keyboard support, focus management, contrast, forms, and tooling.

## Use this skill when

- Reviewing a component or page for accessibility before shipping
- Fixing findings from axe-core, Lighthouse, or pa11y
- Building modal dialogs, menus, tabs, or other interactive widgets
- Designing forms (labels, error messaging, autofill)
- Checking color contrast against AA thresholds
- Onboarding a project to keyboard-only navigation testing

## Do not use this skill when

- You need AAA-only criteria (rare; ask for explicit scope)
- The work is native mobile a11y (iOS / Android have separate guidelines)
- You are tuning assistive-tech-specific behavior outside browser DOM

## Core concepts

- **POUR**: Perceivable (text alternatives, contrast, captions), Operable (keyboard, timing, navigation), Understandable (predictable, error help), Robust (parses cleanly, works with AT).
- **Semantic HTML first**: `<button>`, `<a href>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<label>`, `<fieldset>`, `<table>` carry built-in role, state, keyboard, and focus behavior. Reach for ARIA only when no native element fits.
- **First rule of ARIA**: "If you can use a native HTML element with the semantics and behavior you need, do that instead of repurposing an element and adding ARIA."
- **Landmarks**: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` -- exactly one `<main>` per page. Add `aria-label` to disambiguate multiple navs.
- **Names and descriptions**: every interactive control needs an accessible name (label, `aria-label`, or `aria-labelledby`). `aria-describedby` adds supplementary help/error text.
- **Contrast (WCAG 1.4.3 / 1.4.11)**: text 4.5:1 (3:1 for "large" text -- 18pt or 14pt bold); UI components and graphical objects 3:1 against adjacent colors.
- **Focus visible (2.4.7)**: never set `outline: none` without an equally visible replacement (`:focus-visible` ring).

## Quick start

```html
<!-- Semantic, labeled, keyboard-friendly form field -->
<div class="field">
  <label for="email">Email address</label>
  <input
    id="email"
    type="email"
    name="email"
    required
    autocomplete="email"
    aria-describedby="email-help email-error"
    aria-invalid="false"
  />
  <p id="email-help">We will not share your email.</p>
  <p id="email-error" hidden>Please enter a valid email address.</p>
</div>

<!-- Real button, not a styled div -->
<button type="button" aria-pressed="false">Mute</button>
```

```html
<!-- Skip link: first focusable element on the page -->
<a class="skip-link" href="#main">Skip to main content</a>
<header>...</header>
<main id="main" tabindex="-1">...</main>
```

## Key patterns

- **Use the right control**: clickable `<div>`s require manual `tabindex="0"`, Enter+Space handlers, and a role. A `<button>` gives you all of that free.
- **Labels for inputs**: every `<input>`, `<select>`, `<textarea>` needs a `<label for="id">` (preferred) or wrapping `<label>`. Placeholder is not a label.
- **Modal dialogs**: native `<dialog>` with `.showModal()` traps focus and handles Escape automatically. If you must build one, set `role="dialog" aria-modal="true"`, move focus into it, trap Tab, restore focus on close.
- **Focus management on route changes**: in SPAs, move focus to the page heading or `<main>` after navigation so screen readers announce the new content.
- **Live regions for async updates**: `aria-live="polite"` for status messages, `aria-live="assertive"` (or `role="alert"`) for errors. Don't overuse -- screen readers will interrupt.
- **Tables**: `<table>` with `<thead>`, `<th scope="col">`, and `<caption>`. Avoid layout tables; use CSS grid/flexbox.
- **Tooling**: run axe DevTools or Lighthouse in CI (`@axe-core/playwright`, `jest-axe`). Tools catch ~30-40% of issues -- keyboard test and screen-reader test the rest.

## Common pitfalls

- **`<div onClick>` as a button**: no keyboard support, no role, not focusable. Replace with `<button>`.
- **Missing accessible name**: icon-only buttons need `aria-label="Close"` or visually-hidden text. Same for links containing only an image.
- **`tabindex="-1"` vs `tabindex="0"` vs positive**: `0` = focusable in document order, `-1` = focusable only via JS, positive values = anti-pattern (breaks order). Almost never use positive tabindex.
- **Color as the only signal**: error states must use icon + text + color, not red border alone. WCAG 1.4.1.
- **`role="button"` on a `<div>` without keyboard handlers**: role announces "button" to AT but Enter/Space won't activate without a `keydown` handler. Use `<button>`.
- **Hiding content with `display: none` when it should be available to AT**: visually-hidden text uses an "sr-only" class (clip + 1px size + absolute position), not `display: none` or `visibility: hidden`.
- **Auto-focusing inputs on page load**: disorients screen-reader and keyboard users. Reserve for genuine single-purpose pages (search, login).
- **Form errors announced once and lost**: use a live region or move focus to the error summary so screen readers report what failed.

## Reference

- WCAG 2.2 quick ref: https://www.w3.org/WAI/WCAG22/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- MDN accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- axe-core: https://github.com/dequelabs/axe-core
- Inclusive Components: https://inclusive-components.design/
