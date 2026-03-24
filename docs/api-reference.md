---
metadata:
  lastUpdated: 24-Mar-2026
  staleness: 30d
  tags:
    - api
    - reference
---

# API Reference

Complete reference for all public exports from `@darylcecile/sanitizer`.

## Functions

### sanitize(html, options?)

Sanitize an HTML string. Runs in **safe mode by default**, which strips scripts, event handlers, and dangerous URLs.

```typescript
function sanitize(html: string, options?: SanitizeOptions): string;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `html` | `string` | The HTML string to sanitize |
| `options` | `SanitizeOptions` | Optional configuration (see below) |

**Returns:** The sanitized HTML string.

**SanitizeOptions:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sanitizer` | `Sanitizer \| SanitizerConfig \| "default"` | `"default"` | The sanitizer configuration to use |
| `safe` | `boolean` | `true` | When `true`, applies `removeUnsafe()` to strip all script-executing content |

**Examples:**

```typescript
// Default safe mode
sanitize('<script>alert(1)</script><p>Safe</p>');
// → '<p>Safe</p>'

// Custom config
sanitize('<div><b>bold</b></div>', {
  sanitizer: { elements: ["div", "b"], attributes: [] },
});
// → '<div><b>bold</b></div>'

// With a Sanitizer instance
const s = new Sanitizer({ elements: ["p"], attributes: [] });
sanitize('<p>text</p><div>gone</div>', { sanitizer: s });
// → '<p>text</p>'
```

---

### sanitizeUnsafe(html, options?)

Sanitize an HTML string **without** safety guarantees. Equivalent to calling `sanitize(html, { ...options, safe: false })`.

```typescript
function sanitizeUnsafe(
  html: string,
  options?: Omit<SanitizeOptions, "safe">,
): string;
```

**Examples:**

```typescript
// Everything passes through
sanitizeUnsafe('<script>alert(1)</script>');
// → '<script>alert(1)</script>'

// With filtering but no safety layer
sanitizeUnsafe('<b>bold</b><i>italic</i>', {
  sanitizer: { elements: ["b"], attributes: [] },
});
// → '<b>bold</b>'
```

---

## Sanitizer Class

### Constructor

```typescript
new Sanitizer(config?: SanitizerConfig | SanitizerPresets)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `SanitizerConfig \| "default"` | Configuration dictionary or `"default"` preset |

Throws `TypeError` if the configuration is invalid (for example, using both `elements` and `removeElements`).

```typescript
const s1 = new Sanitizer(); // default preset
const s2 = new Sanitizer("default"); // same as above
const s3 = new Sanitizer({ elements: ["p", "b"], attributes: ["class"] });
```

### Methods

#### get()

Returns the current configuration as a `SanitizerConfig` dictionary with keys sorted alphabetically.

```typescript
get(): SanitizerConfig
```

---

#### allowElement(element)

Add an element to the allow-list. If the element is in `removeElements` or `replaceWithChildrenElements`, it is moved to the allow-list.

```typescript
allowElement(element: SanitizerElement): boolean
```

Returns `true` if the configuration changed.

---

#### removeElement(element)

Block an element. Removes it from `elements` or `replaceWithChildrenElements` if present, and adds it to `removeElements`.

```typescript
removeElement(element: SanitizerElement): boolean
```

Returns `true` if the configuration changed.

---

#### replaceElementWithChildren(element)

Mark an element for unwrapping. The tag is removed but its children are preserved.

```typescript
replaceElementWithChildren(element: SanitizerElement): boolean
```

Returns `true` if the configuration changed. Returns `false` and does nothing if the element is `"html"`.

---

#### allowAttribute(attribute)

Add an attribute to the global allow-list.

```typescript
allowAttribute(attribute: SanitizerAttribute): boolean
```

Returns `true` if the configuration changed.

---

#### removeAttribute(attribute)

Block an attribute globally.

```typescript
removeAttribute(attribute: SanitizerAttribute): boolean
```

Returns `true` if the configuration changed.

---

#### setComments(allow)

Allow or disallow HTML comments.

```typescript
setComments(allow: boolean): boolean
```

Returns `true` if the configuration changed.

---

#### setDataAttributes(allow)

Allow or disallow `data-*` attributes.

```typescript
setDataAttributes(allow: boolean): boolean
```

Returns `true` if the configuration changed.

---

#### removeUnsafe()

Strip all script-executing elements and event handler attributes from the configuration. This is the same transformation applied automatically in safe mode.

```typescript
removeUnsafe(): boolean
```

Returns `true` if the configuration changed.

---

## Types

### SanitizerConfig

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

**Constraints:**
- Cannot have both `elements` and `removeElements`
- Cannot have both `attributes` and `removeAttributes`
- `dataAttributes` can only be `true` when `attributes` is present

### SanitizerElement

```typescript
type SanitizerElement = string | SanitizerElementNamespace;
```

When a string is passed, it is treated as an HTML element name (`namespace` defaults to `http://www.w3.org/1999/xhtml`).

### SanitizerElementNamespace

```typescript
interface SanitizerElementNamespace {
  name: string;
  namespace?: string | null;
}
```

### SanitizerElementWithAttributes

Extends `SanitizerElement` with optional per-element attribute control.

```typescript
type SanitizerElementWithAttributes =
  | string
  | SanitizerElementNamespaceWithAttributes;

interface SanitizerElementNamespaceWithAttributes {
  name: string;
  namespace?: string | null;
  attributes?: SanitizerAttributeNamespace[];
}
```

### SanitizerAttribute

```typescript
type SanitizerAttribute = string | SanitizerAttributeNamespace;
```

### SanitizerAttributeNamespace

```typescript
interface SanitizerAttributeNamespace {
  name: string;
  namespace?: string | null;
}
```

### SanitizerPresets

```typescript
type SanitizerPresets = "default";
```

---

## Constants

### BUILT_IN_SAFE_DEFAULT_CONFIG

The full W3C safe default configuration containing approximately 100 HTML, SVG, and MathML elements with their recommended attributes.

```typescript
import { BUILT_IN_SAFE_DEFAULT_CONFIG } from "@darylcecile/sanitizer";
```

### BUILT_IN_SAFE_BASELINE_CONFIG

The baseline configuration defining which elements and attributes are always considered unsafe. Used internally by `removeUnsafe()`.

```typescript
import { BUILT_IN_SAFE_BASELINE_CONFIG } from "@darylcecile/sanitizer";
```

---

## Parser and Serializer

### parseHTML(html)

Parse an HTML string into a `DocumentNode` AST.

```typescript
function parseHTML(html: string): DocumentNode;
```

### Parser

The `Parser` class provides low-level control over HTML parsing. Construct it with an HTML string and a `DocumentNode`, then call `parse()`.

```typescript
import { Parser, createDocument } from "@darylcecile/sanitizer";

const doc = createDocument();
const parser = new Parser("<p>Hello</p>", doc);
parser.parse();
```

### serialize(node)

Serialize a `DocumentNode` or `ElementNode` back to an HTML string.

```typescript
function serialize(node: DocumentNode | ElementNode): string;
```

### AST Factory Functions

| Function | Description |
|----------|-------------|
| `createDocument()` | Create an empty `DocumentNode` |
| `createElement(tagName, namespace, attributes?)` | Create an `ElementNode` |
| `createText(value)` | Create a `TextNode` |
| `createComment(value)` | Create a `CommentNode` |
| `createDocumentType(name, publicId?, systemId?)` | Create a `DocumentTypeNode` |

### AST Manipulation

| Function | Description |
|----------|-------------|
| `appendChild(parent, child)` | Append a child node to a parent |
| `removeChild(parent, child)` | Remove a child from its parent |
| `replaceWithChildren(parent, element)` | Remove an element but keep its children in place |

### AST Node Types

| Export | Value | Description |
|--------|-------|-------------|
| `NodeType.Document` | `0` | Document root |
| `NodeType.Element` | `1` | HTML/SVG/MathML element |
| `NodeType.Text` | `3` | Text content |
| `NodeType.Comment` | `8` | HTML comment |
| `NodeType.DocumentType` | `10` | DOCTYPE declaration |

See the [Parser Guide](./parser.md) for detailed usage and examples.
