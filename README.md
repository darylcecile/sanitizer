# @darylcecile/sanitizer

A **zero-dependency**, **SSR-safe** HTML Sanitizer following the [W3C Sanitizer API spec](https://wicg.github.io/sanitizer-api). Works with Bun, Node, Deno, or any JavaScript runtime — no browser DOM required.

## Features

- 🔒 **XSS protection** — strips `<script>`, event handlers, `javascript:` URLs, and more
- 📐 **W3C spec-compliant** — follows the [Sanitizer API](https://wicg.github.io/sanitizer-api) configuration model
- 🌐 **SSR-safe** — custom HTML parser & serializer, no browser APIs needed
- 📦 **Zero dependencies** — lightweight, self-contained
- 🧩 **Configurable** — element/attribute allow-lists, remove-lists, `replaceWithChildrenElements`
- ✅ **TypeScript-first** — full type definitions

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

## Custom Configuration

```typescript
import { sanitize, Sanitizer } from "@darylcecile/sanitizer";

// Allow only specific elements
sanitize("<div><b>bold</b></div>", {
  sanitizer: { elements: ["div", "b"], attributes: [] },
});
// → '<div><b>bold</b></div>'

// Remove specific elements
sanitize("<div><span>text</span></div>", {
  sanitizer: { removeElements: ["span"] },
  safe: false,
});
// → '<div></div>'

// Replace elements with their children (unwrap)
sanitize("<div><b>bold</b> text</div>", {
  sanitizer: {
    removeElements: [],
    removeAttributes: [],
    replaceWithChildrenElements: ["b"],
  },
  safe: false,
});
// → '<div>bold text</div>'

// Allow data-* attributes
sanitize('<div data-id="42">text</div>', {
  sanitizer: { elements: ["div"], attributes: [], dataAttributes: true },
});
// → '<div data-id="42">text</div>'

// Preserve comments
sanitize("<!-- note --><p>text</p>", {
  sanitizer: { elements: ["p"], attributes: [], comments: true },
});
// → '<!-- note --><p>text</p>'
```

## Sanitizer Class

Create reusable sanitizer instances with the `Sanitizer` class:

```typescript
import { Sanitizer, sanitize } from "@darylcecile/sanitizer";

// Use the built-in safe default (W3C spec default allowlist)
const safe = new Sanitizer("default");

// Create a custom sanitizer
const custom = new Sanitizer({
  elements: ["p", "b", "i", "a"],
  attributes: ["href", "class"],
});

// Modify the config programmatically
custom.allowElement("div");
custom.removeElement("i");
custom.replaceElementWithChildren("b");
custom.allowAttribute("id");

// Use with sanitize()
sanitize(html, { sanitizer: custom });

// Inspect the config
console.log(custom.get());
```

## Unsafe Mode

Skip the safety checks (allows scripts, event handlers, etc.):

```typescript
import { sanitizeUnsafe } from "@darylcecile/sanitizer";

sanitizeUnsafe('<div onclick="handler()">text</div>');
// → '<div onclick="handler()">text</div>'
```

## API Reference

### `sanitize(html, options?)`

Sanitize an HTML string. Safe by default.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sanitizer` | `Sanitizer \| SanitizerConfig \| "default"` | `"default"` | Sanitizer config |
| `safe` | `boolean` | `true` | Apply safety defaults |

### `sanitizeUnsafe(html, options?)`

Sanitize without safety guarantees.

### `new Sanitizer(config?)`

Create a reusable Sanitizer instance. Accepts a `SanitizerConfig` or `"default"`.

#### Methods

| Method | Description |
|--------|-------------|
| `get()` | Returns the current config dictionary |
| `allowElement(element)` | Add element to allow-list |
| `removeElement(element)` | Remove/block an element |
| `replaceElementWithChildren(element)` | Unwrap an element |
| `allowAttribute(attribute)` | Allow an attribute globally |
| `removeAttribute(attribute)` | Remove an attribute globally |
| `setComments(allow)` | Allow/disallow HTML comments |
| `setDataAttributes(allow)` | Allow/disallow `data-*` attributes |
| `removeUnsafe()` | Strip all script-executing config |

### `SanitizerConfig`

```typescript
interface SanitizerConfig {
  elements?: SanitizerElementWithAttributes[];
  removeElements?: SanitizerElement[];
  replaceWithChildrenElements?: SanitizerElement[];
  attributes?: SanitizerAttribute[];
  removeAttributes?: SanitizerAttribute[];
  comments?: boolean;
  dataAttributes?: boolean;
}
```

## Running Tests

```bash
bun test
```
