# @darylcecile/sanitizer

A **zero-dependency**, **SSR-safe** HTML Sanitizer following the [W3C Sanitizer API spec](https://wicg.github.io/sanitizer-api). Works with Bun, Node, Deno, or any JavaScript runtime — no browser DOM required.

## Features

- 🔒 **XSS protection** — strips `<script>`, event handlers, `javascript:` URLs, and more
- 📐 **W3C spec-compliant** — follows the [Sanitizer API](https://wicg.github.io/sanitizer-api) configuration model
- 🌐 **SSR-safe** — custom HTML parser & serializer, no browser APIs needed
- 📦 **Zero dependencies** — lightweight, self-contained
- 🧩 **Configurable** — element/attribute allow-lists, remove-lists, `replaceWithChildrenElements`
- ✅ **TypeScript-first** — full type definitions
- 🧪 **Battle-tested** — 188 tests including adapted [sanitize-html](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html) test vectors

## Install

```bash
bun add @darylcecile/sanitizer
```

## Quick Start

```typescript
import { sanitize } from "@darylcecile/sanitizer";

// Safe by default — strips scripts, event handlers, dangerous URLs
sanitize('<div onclick="alert(1)">Hello</div>');
// → '<div>Hello</div>'

sanitize('<script>alert("xss")</script><p>Safe content</p>');
// → '<p>Safe content</p>'

sanitize('<a href="javascript:alert(1)">click</a>');
// → '<a>click</a>'
```

## What Gets Stripped (Safe Mode)

By default, `sanitize()` runs in **safe mode** using the W3C built-in safe default configuration. This:

| Category | Behavior |
|----------|----------|
| **Script elements** | `<script>`, SVG `<script>` — removed with content |
| **Embedding elements** | `<iframe>`, `<embed>`, `<object>`, `<frame>` — removed |
| **SVG `<use>`** | Removed (can reference external XSS payloads) |
| **Event handlers** | All `on*` attributes (`onclick`, `onerror`, `onload`, etc.) — stripped |
| **`javascript:` URLs** | Stripped from `href`, `action`, `formaction` and SVG animation attributes |
| **Comments** | Stripped by default |
| **Unknown elements** | Any element not in the W3C safe default allow-list — removed |
| **Unsafe attributes** | Any attribute not in the W3C safe default — stripped |

### What's Preserved

The default config allows ~100 safe HTML, SVG, and MathML elements with their appropriate attributes. This includes:

- **Structure**: `<div>`, `<span>`, `<p>`, `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`, etc.
- **Text formatting**: `<b>`, `<i>`, `<em>`, `<strong>`, `<code>`, `<pre>`, `<mark>`, `<sub>`, `<sup>`, etc.
- **Lists**: `<ul>`, `<ol>`, `<li>`, `<dl>`, `<dt>`, `<dd>`
- **Tables**: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` (with `colspan`, `rowspan`, etc.)
- **Links**: `<a>` (with `href`, `hreflang`, `type`)
- **Headings**: `<h1>` through `<h6>`
- **Quotes**: `<blockquote>` (with `cite`), `<q>`
- **Time/edits**: `<time>` (with `datetime`), `<del>`, `<ins>` (with `cite`, `datetime`)
- **SVG**: `<svg>`, `<circle>`, `<rect>`, `<path>`, `<text>`, `<g>`, etc.
- **MathML**: `<math>`, `<mrow>`, `<mi>`, `<mo>`, `<mfrac>`, etc.
- **Global attributes**: `dir`, `lang`, `title`, `color`, `fill`, `stroke`, `transform`, and more presentation/styling attributes

## Configuration

### Element Allow-List

Only allow specific elements. **Elements not in the list — and their entire subtree — are removed.**

```typescript
sanitize("<div><p>text</p><span>more</span></div>", {
  sanitizer: { elements: ["div", "p"], attributes: [] },
});
// → '<div><p>text</p></div>'   (span + subtree removed)
```

### Element Remove-List

Block specific elements while allowing everything else:

```typescript
sanitize("<div><span>text</span><b>bold</b></div>", {
  sanitizer: { removeElements: ["span"] },
  safe: false,
});
// → '<div><b>bold</b></div>'
```

### Replace Elements With Children (Unwrap)

Remove the tag but keep its content — useful when you want the text but not the element:

```typescript
sanitize("<div><b>bold</b> and <i>italic</i></div>", {
  sanitizer: {
    removeElements: [],
    removeAttributes: [],
    replaceWithChildrenElements: ["b", "i"],
  },
  safe: false,
});
// → '<div>bold and italic</div>'
```

### Attribute Allow-List

Only allow specific attributes globally:

```typescript
sanitize('<div class="x" id="y" title="z">text</div>', {
  sanitizer: { elements: ["div"], attributes: ["class"] },
});
// → '<div class="x">text</div>'
```

### Attribute Remove-List

Block specific attributes:

```typescript
sanitize('<div class="x" id="y">text</div>', {
  sanitizer: { removeElements: [], removeAttributes: ["id"] },
  safe: false,
});
// → '<div class="x">text</div>'
```

### Per-Element Attributes

Allow different attributes on different elements:

```typescript
sanitize(
  '<a href="test.html" class="link">link</a><div class="box">box</div>',
  {
    sanitizer: {
      elements: [
        { name: "a", namespace: "http://www.w3.org/1999/xhtml",
          attributes: [{ name: "href", namespace: null }] },
        { name: "div", namespace: "http://www.w3.org/1999/xhtml",
          attributes: [{ name: "class", namespace: null }] },
      ],
      attributes: [],
    },
  },
);
// → '<a href="test.html">link</a><div class="box">box</div>'
```

### Data Attributes

Allow all `data-*` attributes:

```typescript
sanitize('<div data-id="42" data-role="main">text</div>', {
  sanitizer: { elements: ["div"], attributes: [], dataAttributes: true },
});
// → '<div data-id="42" data-role="main">text</div>'
```

### Comments

Preserve HTML comments:

```typescript
sanitize("<!-- note --><p>text</p>", {
  sanitizer: { elements: ["p"], attributes: [], comments: true },
});
// → '<!-- note --><p>text</p>'
```

## Unsafe Mode

Skip the safety checks (allows scripts, event handlers, etc.):

```typescript
import { sanitizeUnsafe } from "@darylcecile/sanitizer";

// Everything is allowed
sanitizeUnsafe('<div onclick="handler()">text</div>');
// → '<div onclick="handler()">text</div>'

sanitizeUnsafe('<script>console.log("hi")</script>');
// → '<script>console.log("hi")</script>'
```

You can also use `sanitize()` with `safe: false`:

```typescript
sanitize(html, { sanitizer: myConfig, safe: false });
```

## Sanitizer Class

Create reusable, mutable sanitizer instances:

```typescript
import { Sanitizer, sanitize } from "@darylcecile/sanitizer";

// Built-in safe default (W3C spec default allowlist)
const safe = new Sanitizer("default");
// or: new Sanitizer()  — same thing

// Custom config
const custom = new Sanitizer({
  elements: ["p", "b", "i", "a"],
  attributes: ["href", "class"],
});

// Modify programmatically
custom.allowElement("div");        // add to allow-list → true
custom.removeElement("i");         // remove from allow-list → true
custom.replaceElementWithChildren("b"); // unwrap <b> → true
custom.allowAttribute("id");       // add to allow-list → true
custom.removeAttribute("class");   // remove from allow-list → true
custom.setComments(true);          // allow comments → true
custom.setDataAttributes(true);    // allow data-* attrs → true
custom.removeUnsafe();             // strip script-capable config → true

// Use with sanitize()
const result = sanitize(html, { sanitizer: custom });

// Inspect current config
console.log(custom.get());
```

### Modifier Methods

All modifier methods return `boolean` — `true` if the config was changed, `false` if no change was needed.

| Method | Description |
|--------|-------------|
| `allowElement(element)` | Add element to allow-list (or remove from remove-list) |
| `removeElement(element)` | Remove/block an element |
| `replaceElementWithChildren(element)` | Unwrap an element (keep children, remove tag) |
| `allowAttribute(attribute)` | Allow an attribute globally |
| `removeAttribute(attribute)` | Remove an attribute globally |
| `setComments(allow)` | Allow/disallow HTML comments |
| `setDataAttributes(allow)` | Allow/disallow `data-*` attributes |
| `removeUnsafe()` | Strip all script-executing elements and attributes |
| `get()` | Returns the current configuration dictionary (sorted) |

## API Reference

### `sanitize(html, options?)`

Sanitize an HTML string. **Safe by default.**

```typescript
function sanitize(html: string, options?: SanitizeOptions): string;
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sanitizer` | `Sanitizer \| SanitizerConfig \| "default"` | `"default"` | Sanitizer configuration |
| `safe` | `boolean` | `true` | Apply safety defaults (strip scripts, event handlers, `javascript:` URLs) |

### `sanitizeUnsafe(html, options?)`

Sanitize without safety guarantees. Equivalent to `sanitize(html, { ...options, safe: false })`.

### `new Sanitizer(config?)`

Create a reusable Sanitizer instance. Accepts a `SanitizerConfig` dictionary or `"default"`.

### `SanitizerConfig`

```typescript
interface SanitizerConfig {
  // Element lists (use ONE of elements/removeElements, not both)
  elements?: SanitizerElementWithAttributes[];  // allow-list
  removeElements?: SanitizerElement[];           // block-list
  replaceWithChildrenElements?: SanitizerElement[]; // unwrap list

  // Attribute lists (use ONE of attributes/removeAttributes, not both)
  attributes?: SanitizerAttribute[];             // allow-list
  removeAttributes?: SanitizerAttribute[];       // block-list

  comments?: boolean;        // allow HTML comments
  dataAttributes?: boolean;  // allow data-* attributes (only with attributes allow-list)
}

// Elements/attributes can be strings (shorthand) or objects (with namespace)
type SanitizerElement = string | { name: string; namespace?: string | null };
type SanitizerAttribute = string | { name: string; namespace?: string | null };
```

### Built-in Configs

```typescript
import {
  BUILT_IN_SAFE_DEFAULT_CONFIG,   // W3C allowlist (~100 elements)
  BUILT_IN_SAFE_BASELINE_CONFIG,  // blocks only script-executing content
} from "@darylcecile/sanitizer";
```

## Key Differences from `sanitize-html`

| Feature | This library | `sanitize-html` |
|---------|-------------|-----------------|
| **Spec** | W3C Sanitizer API | Custom API |
| **Dependencies** | Zero | htmlparser2, postcss, etc. |
| **SSR-safe** | ✅ Custom parser | ✅ htmlparser2 |
| **Disallowed elements** | Removed with subtree (use `replaceWithChildrenElements` to unwrap) | Text preserved by default (discard mode) |
| **Tag transforms** | Not supported | `transformTags` |
| **Style filtering** | Not supported | `allowedStyles`, `allowedClasses` |
| **Scheme filtering** | `javascript:` only (per spec) | `allowedSchemes`, per-tag schemes |
| **Hostname filtering** | Not supported | `allowedIframeHostnames`, `allowedScriptHostnames` |
| **Escape mode** | Not supported | `disallowedTagsMode: 'escape'` |

## Running Tests

```bash
bun test
```

The test suite includes 188 tests:
- **73 core tests** — sanitization, config, parser, serializer
- **115 adapted tests** — ported from [sanitize-html](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html) covering XSS vectors, entity handling, real-world patterns, and edge cases
