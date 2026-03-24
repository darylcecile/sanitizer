---
metadata:
  lastUpdated: 24-Mar-2026
  staleness: 30d
  tags:
    - getting-started
    - quickstart
---

# Getting Started

`@darylcecile/sanitizer` is a zero-dependency, SSR-safe HTML sanitizer that follows the [W3C Sanitizer API](https://wicg.github.io/sanitizer-api) specification. It works in any JavaScript runtime — Bun, Node, Deno — without requiring a browser DOM.

## Installation

```bash
bun add @darylcecile/sanitizer
```

Or with npm:

```bash
npm install @darylcecile/sanitizer
```

## Your First Sanitization

Import `sanitize` and pass it an HTML string:

```typescript
import { sanitize } from "@darylcecile/sanitizer";

const clean = sanitize('<p>Hello <b>world</b></p>');
// → '<p>Hello <b>world</b></p>'
```

By default, `sanitize()` runs in **safe mode** — it strips anything that could execute scripts or otherwise compromise security:

```typescript
// Scripts are removed entirely (element + content)
sanitize('<script>alert("xss")</script><p>Safe</p>');
// → '<p>Safe</p>'

// Event handlers are stripped from attributes
sanitize('<div onclick="alert(1)">Hello</div>');
// → '<div>Hello</div>'

// javascript: URLs are removed from href
sanitize('<a href="javascript:alert(1)">click</a>');
// → '<a>click</a>'
```

## What Gets Stripped

The safe default strips anything that can execute code:

| Category | Examples |
|----------|----------|
| Script elements | `<script>`, SVG `<script>` |
| Embedding elements | `<iframe>`, `<embed>`, `<object>`, `<frame>` |
| Event handlers | `onclick`, `onerror`, `onload`, and 90+ others |
| Dangerous URLs | `javascript:` in `href`, `action`, `formaction` |
| Comments | HTML comments are removed |
| Unknown elements | Elements not in the W3C safe default allow-list |

## What Gets Preserved

The default configuration allows approximately 100 safe HTML elements along with their appropriate attributes:

- **Structure**: `<div>`, `<span>`, `<p>`, `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`
- **Text**: `<b>`, `<i>`, `<em>`, `<strong>`, `<code>`, `<pre>`, `<mark>`, `<sub>`, `<sup>`
- **Lists**: `<ul>`, `<ol>`, `<li>`, `<dl>`, `<dt>`, `<dd>`
- **Tables**: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- **Links**: `<a>` with `href`, `hreflang`, `type`
- **Headings**: `<h1>` through `<h6>`
- **SVG**: `<svg>`, `<circle>`, `<rect>`, `<path>`, `<text>`, `<g>`
- **MathML**: `<math>`, `<mrow>`, `<mi>`, `<mo>`, `<mfrac>`

## Next Steps

- [Configuration Guide](./configuration.md) — customise which elements and attributes are allowed
- [Advanced Usage](./advanced-usage.md) — the Sanitizer class, per-element attributes, and unsafe mode
- [HTML Parser](./parser.md) — parse HTML into an AST for custom transformations
- [API Reference](./api-reference.md) — full reference for all exports
