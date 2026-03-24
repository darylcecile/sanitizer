---
metadata:
  lastUpdated: 24-Mar-2026
  staleness: 30d
  tags:
    - configuration
    - elements
    - attributes
---

# Configuration Guide

The `sanitize()` function accepts an options object to control which elements and attributes survive sanitization. Configuration follows the W3C Sanitizer API specification.

## Passing a Configuration

```typescript
import { sanitize } from "@darylcecile/sanitizer";

const result = sanitize(html, {
  sanitizer: {
    elements: ["p", "b", "i", "a"],
    attributes: ["href"],
  },
});
```

The `sanitizer` option accepts a `SanitizerConfig` object, a `Sanitizer` class instance, or the string `"default"`.

## Element Allow-List

Specify exactly which elements are permitted. Elements not in the list — **and their entire subtree** — are removed.

```typescript
sanitize("<div><p>text</p><span>more</span></div>", {
  sanitizer: { elements: ["div", "p"], attributes: [] },
});
// → '<div><p>text</p></div>'
// The <span> and its content are removed entirely
```

> **Note:** This differs from libraries like `sanitize-html`, which preserve text content by default when removing tags. In the W3C spec, removing an element means removing it and everything inside it.

## Element Remove-List

Instead of specifying what to allow, you can specify what to block. Everything else passes through.

```typescript
sanitize("<div><span>text</span><b>bold</b></div>", {
  sanitizer: { removeElements: ["span"] },
  safe: false,
});
// → '<div><b>bold</b></div>'
```

> **Important:** You cannot use both `elements` and `removeElements` in the same configuration. The W3C spec requires one or the other.

## Unwrapping Elements

Use `replaceWithChildrenElements` to remove the tag but keep its children. This is useful when you want to strip formatting tags but preserve their text content.

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

The `<b>` and `<i>` tags are removed, but their text content is promoted to the parent element.

## Attribute Allow-List

Control which attributes are permitted globally across all elements:

```typescript
sanitize('<div class="x" id="y" title="z">text</div>', {
  sanitizer: { elements: ["div"], attributes: ["class"] },
});
// → '<div class="x">text</div>'
```

## Attribute Remove-List

Block specific attributes while allowing everything else:

```typescript
sanitize('<div class="x" id="y">text</div>', {
  sanitizer: { removeElements: [], removeAttributes: ["id"] },
  safe: false,
});
// → '<div class="x">text</div>'
```

> Like elements, you cannot use both `attributes` and `removeAttributes` in the same config.

## Per-Element Attributes

Allow different attributes on different elements by using the object form in the `elements` list:

```typescript
sanitize(
  '<a href="/page" class="link">link</a><div class="box">box</div>',
  {
    sanitizer: {
      elements: [
        { name: "a", attributes: [{ name: "href" }] },
        { name: "div", attributes: [{ name: "class" }] },
      ],
      attributes: [],
    },
  },
);
// → '<a href="/page">link</a><div class="box">box</div>'
// href is only allowed on <a>, class is only allowed on <div>
```

## Data Attributes

Allow all `data-*` attributes by setting `dataAttributes: true`. This only works when using an `attributes` allow-list.

```typescript
sanitize('<div data-id="42" data-role="main">text</div>', {
  sanitizer: { elements: ["div"], attributes: [], dataAttributes: true },
});
// → '<div data-id="42" data-role="main">text</div>'
```

## Comments

HTML comments are stripped by default. To preserve them:

```typescript
sanitize("<!-- note --><p>text</p>", {
  sanitizer: { elements: ["p"], attributes: [], comments: true },
});
// → '<!-- note --><p>text</p>'
```

## Safe Mode

By default, `sanitize()` runs in safe mode (`safe: true`). This applies `removeUnsafe()` to any configuration you provide, which strips:

- All script-executing elements (`<script>`, `<svg:script>`, etc.)
- All event handler attributes (`onclick`, `onerror`, etc.)
- `javascript:` URLs from navigating attributes (`href`, `action`, `formaction`)

Set `safe: false` to bypass these safety checks (see [Advanced Usage](./advanced-usage.md) for details).

## Configuration Rules

The W3C spec enforces these constraints:

1. **Elements**: use `elements` (allow-list) or `removeElements` (block-list), not both
2. **Attributes**: use `attributes` (allow-list) or `removeAttributes` (block-list), not both
3. **`dataAttributes`** can only be `true` when using an `attributes` allow-list
4. An empty config `{}` is normalised to `{ removeElements: [], removeAttributes: [] }` which allows everything through

If an invalid configuration is passed to the `Sanitizer` constructor, it throws a `TypeError`.

## Next Steps

- [Advanced Usage](./advanced-usage.md) — the Sanitizer class, unsafe mode, and the built-in configs
- [API Reference](./api-reference.md) — full reference for all exports
