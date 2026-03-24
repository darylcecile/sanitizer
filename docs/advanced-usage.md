---
metadata:
  lastUpdated: 24-Mar-2026
  staleness: 30d
  tags:
    - advanced
    - sanitizer-class
    - unsafe-mode
---

# Advanced Usage

This guide covers the `Sanitizer` class, unsafe mode, built-in configurations, and namespace-aware usage for SVG and MathML content.

## The Sanitizer Class

For repeated sanitization with the same rules, create a reusable `Sanitizer` instance:

```typescript
import { Sanitizer, sanitize } from "@darylcecile/sanitizer";

const mySanitizer = new Sanitizer({
  elements: ["p", "b", "i", "a"],
  attributes: ["href", "class"],
});

// Use it with sanitize()
const result = sanitize(html, { sanitizer: mySanitizer });
```

### Default Preset

Pass `"default"` (or no arguments) to use the W3C built-in safe default configuration:

```typescript
const safe = new Sanitizer("default");
const alsoSafe = new Sanitizer(); // same thing
```

### Modifier Methods

The Sanitizer class provides methods to modify the configuration after creation. All modifier methods return `boolean` — `true` if the configuration changed, `false` if no change was needed.

```typescript
const s = new Sanitizer({
  elements: ["p", "b", "i"],
  attributes: ["href"],
});

// Add an element to the allow-list
s.allowElement("div"); // → true

// Remove an element (blocks it)
s.removeElement("i"); // → true

// Unwrap an element (keep children, remove the tag)
s.replaceElementWithChildren("b"); // → true

// Allow an attribute
s.allowAttribute("class"); // → true

// Block an attribute
s.removeAttribute("href"); // → true

// Allow or disallow HTML comments
s.setComments(true); // → true

// Allow or disallow data-* attributes
s.setDataAttributes(true); // → true
```

### Inspecting Configuration

Use `get()` to retrieve the current configuration as a dictionary. Keys are sorted alphabetically per the W3C spec.

```typescript
const config = s.get();
console.log(config);
// {
//   attributes: [...],
//   comments: true,
//   dataAttributes: true,
//   elements: [...],
//   replaceWithChildrenElements: [...]
// }
```

### Applying removeUnsafe

The `removeUnsafe()` method strips all script-executing elements and event handler attributes from the internal configuration:

```typescript
const s = new Sanitizer({
  removeElements: [],
  removeAttributes: [],
});

// Before: allows everything
s.removeUnsafe();
// After: script, iframe, object, embed etc. are in removeElements
//        all on* attributes are in removeAttributes
```

This is the same transformation that `sanitize()` applies automatically in safe mode.

## Unsafe Mode

Sometimes you need to pass through content without the safety layer — for example, rendering trusted HTML from your own CMS, or performing structural transformations without XSS protection.

### Using sanitizeUnsafe

```typescript
import { sanitizeUnsafe } from "@darylcecile/sanitizer";

// Everything passes through with no config
sanitizeUnsafe('<div onclick="handler()">text</div>');
// → '<div onclick="handler()">text</div>'

sanitizeUnsafe('<script>console.log("hi")</script>');
// → '<script>console.log("hi")</script>'
```

### Using safe: false

You can also set `safe: false` on the regular `sanitize()` function. This lets you apply custom filtering without the automatic safety layer:

```typescript
import { sanitize } from "@darylcecile/sanitizer";

// Remove only <b> tags, but allow everything else — including scripts
sanitize("<b>bold</b><script>alert(1)</script>", {
  sanitizer: { removeElements: ["b"] },
  safe: false,
});
// → '<script>alert(1)</script>'
```

> **Warning:** Only use unsafe mode with content you fully trust. It does not strip scripts, event handlers, or dangerous URLs.

## Built-in Configurations

The library exports two built-in configurations:

### BUILT_IN_SAFE_DEFAULT_CONFIG

The full W3C safe default allow-list containing approximately 100 HTML, SVG, and MathML elements with their recommended attributes. This is what `new Sanitizer("default")` uses.

```typescript
import { BUILT_IN_SAFE_DEFAULT_CONFIG } from "@darylcecile/sanitizer";
```

### BUILT_IN_SAFE_BASELINE_CONFIG

The baseline configuration that defines which elements and attributes are always considered unsafe. Used internally by `removeUnsafe()`.

```typescript
import { BUILT_IN_SAFE_BASELINE_CONFIG } from "@darylcecile/sanitizer";
```

## Namespace-Aware Elements and Attributes

For SVG and MathML content, you can specify namespaces explicitly using the object form:

```typescript
sanitize(svgContent, {
  sanitizer: {
    elements: [
      { name: "svg", namespace: "http://www.w3.org/2000/svg" },
      { name: "circle", namespace: "http://www.w3.org/2000/svg" },
      { name: "rect", namespace: "http://www.w3.org/2000/svg" },
    ],
    attributes: [
      { name: "cx" },
      { name: "cy" },
      { name: "r" },
      { name: "width" },
      { name: "height" },
    ],
  },
});
```

When you use the string shorthand (`"svg"`), the HTML namespace (`http://www.w3.org/1999/xhtml`) is assumed. Use the object form with an explicit `namespace` for SVG or MathML elements.

The three recognised namespaces are:

| Namespace | URI |
|-----------|-----|
| HTML | `http://www.w3.org/1999/xhtml` |
| SVG | `http://www.w3.org/2000/svg` |
| MathML | `http://www.w3.org/1998/Math/MathML` |

## Combining Techniques

A common pattern is to start with the default safe config and adjust it:

```typescript
import { Sanitizer, sanitize } from "@darylcecile/sanitizer";

const s = new Sanitizer("default");

// Add support for images (not in the default allow-list)
s.allowElement("img");
s.allowAttribute("src");
s.allowAttribute("alt");
s.allowAttribute("width");
s.allowAttribute("height");

// Allow data attributes for your app
s.setDataAttributes(true);

// Use it
const clean = sanitize(userHtml, { sanitizer: s });
```

## Next Steps

- [API Reference](./api-reference.md) — full reference for all exports
- [HTML Parser](./parser.md) — parse HTML into an AST for custom transformations
- [Configuration Guide](./configuration.md) — element and attribute filtering options
