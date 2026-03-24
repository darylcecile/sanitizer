---
metadata:
  lastUpdated: 24-Mar-2026
  staleness: 30d
  tags:
    - parser
    - ast
    - advanced
---

# HTML Parser

The library exposes its internal HTML parser and serializer, giving you direct access to the AST for custom transformations, analysis, or any use case beyond sanitization.

## Quick Example

```typescript
import { parseHTML, serialize } from "@darylcecile/sanitizer";

const doc = parseHTML("<p>Hello <b>world</b></p>");
console.log(doc.children.length); // 1

const html = serialize(doc);
console.log(html); // '<p>Hello <b>world</b></p>'
```

## Parsing HTML

The `parseHTML` function takes an HTML string and returns a `DocumentNode` — the root of the AST tree.

```typescript
import { parseHTML } from "@darylcecile/sanitizer";

const doc = parseHTML(`
  <div class="container">
    <h1>Title</h1>
    <p>Some <em>emphasised</em> text.</p>
  </div>
`);
```

The parser handles:

- **Void elements** — `<br>`, `<img>`, `<hr>`, `<input>`, etc. are self-closing
- **Raw text elements** — `<script>` and `<style>` content is not parsed as HTML
- **Auto-closing** — `<p>` inside `<p>`, `<li>` inside `<li>`, and similar are auto-closed per the HTML spec
- **Attributes** — quoted, unquoted, and boolean attributes
- **Comments** — `<!-- ... -->` are preserved as comment nodes
- **Doctypes** — `<!DOCTYPE html>` is preserved
- **SVG and MathML** — namespace switching for `<svg>` and `<math>` elements
- **Malformed HTML** — unclosed tags, missing quotes, and other quirks are handled gracefully

## The AST

The AST is a lightweight DOM-like tree with five node types:

### Node Types

```typescript
import { NodeType } from "@darylcecile/sanitizer";

NodeType.Document;    // 0 — root node
NodeType.Element;     // 1 — HTML elements
NodeType.Text;        // 3 — text content
NodeType.Comment;     // 8 — HTML comments
NodeType.DocumentType; // 10 — DOCTYPE declarations
```

### DocumentNode

The root of the tree. Returned by `parseHTML`.

```typescript
interface DocumentNode {
  type: NodeType.Document;
  children: ChildNode[];
  parent: null;
}
```

### ElementNode

Represents an HTML, SVG, or MathML element.

```typescript
interface ElementNode {
  type: NodeType.Element;
  tagName: string;        // lowercased tag name
  namespace: string;      // e.g. "http://www.w3.org/1999/xhtml"
  attributes: Attribute[];
  children: ChildNode[];
  parent: ParentNode | null;
}

interface Attribute {
  name: string;
  value: string;
  namespace: string | null;
}
```

### TextNode

Plain text content.

```typescript
interface TextNode {
  type: NodeType.Text;
  value: string;
  parent: ParentNode | null;
}
```

### CommentNode

An HTML comment.

```typescript
interface CommentNode {
  type: NodeType.Comment;
  value: string;            // the text between <!-- and -->
  parent: ParentNode | null;
}
```

## Walking the Tree

Since the AST is a plain object tree, you can walk it with simple recursion:

```typescript
import { parseHTML, NodeType } from "@darylcecile/sanitizer";
import type { ChildNode, ElementNode } from "@darylcecile/sanitizer";

const doc = parseHTML("<div><p>Hello</p><p>World</p></div>");

function walk(node: ChildNode) {
  if (node.type === NodeType.Element) {
    console.log(`<${node.tagName}> with ${node.children.length} children`);
    for (const child of node.children) {
      walk(child);
    }
  } else if (node.type === NodeType.Text) {
    console.log(`Text: "${node.value}"`);
  }
}

for (const child of doc.children) {
  walk(child);
}
// <div> with 2 children
// <p> with 1 children
// Text: "Hello"
// <p> with 1 children
// Text: "World"
```

## Modifying the Tree

The library exports factory functions and tree manipulation utilities:

```typescript
import {
  parseHTML,
  serialize,
  createElement,
  createText,
  appendChild,
  removeChild,
} from "@darylcecile/sanitizer";

const doc = parseHTML("<ul><li>First</li><li>Second</li></ul>");

// Add a new list item
const ul = doc.children[0]; // the <ul> element
if (ul.type === 1) { // NodeType.Element
  const li = createElement("li", "http://www.w3.org/1999/xhtml");
  const text = createText("Third");
  appendChild(li, text);
  appendChild(ul, li);
}

console.log(serialize(doc));
// '<ul><li>First</li><li>Second</li><li>Third</li></ul>'
```

### Factory Functions

| Function | Description |
|----------|-------------|
| `createDocument()` | Create an empty document root |
| `createElement(tagName, namespace, attributes?)` | Create an element node |
| `createText(value)` | Create a text node |
| `createComment(value)` | Create a comment node |
| `createDocumentType(name, publicId?, systemId?)` | Create a doctype node |

### Tree Manipulation

| Function | Description |
|----------|-------------|
| `appendChild(parent, child)` | Append a child node to a parent |
| `removeChild(parent, child)` | Remove a child from its parent |
| `replaceWithChildren(parent, element)` | Remove an element but keep its children in place |

## Serialising Back to HTML

Use `serialize` to convert any `DocumentNode` or `ElementNode` back to an HTML string:

```typescript
import { parseHTML, serialize } from "@darylcecile/sanitizer";

const doc = parseHTML("<!-- hello --><p>Text &amp; more</p>");
console.log(serialize(doc));
// '<!-- hello --><p>Text &amp; more</p>'
```

The serializer handles:

- Proper escaping of `<`, `>`, `&` in text content
- Proper escaping of `"` in attribute values
- Void elements rendered without closing tags
- Raw text elements rendered without escaping their content

## Using the Parser Class Directly

For more control, you can use the `Parser` class directly:

```typescript
import { Parser, createDocument } from "@darylcecile/sanitizer";

const doc = createDocument();
const parser = new Parser("<p>Hello</p>", doc);
parser.parse();

console.log(doc.children.length); // 1
```

This is equivalent to calling `parseHTML("<p>Hello</p>")`, but lets you supply your own pre-created document node.

## Combining with Sanitization

Parse, inspect, sanitize, and serialise in separate steps:

```typescript
import { parseHTML, serialize, sanitize } from "@darylcecile/sanitizer";

const doc = parseHTML(userHtml);

// Inspect the AST first
const hasScripts = doc.children.some(
  c => c.type === 1 && c.tagName === "script"
);

if (hasScripts) {
  console.warn("Input contained script tags");
}

// Then sanitize the original HTML
const clean = sanitize(userHtml);
```

## Next Steps

- [Getting Started](./getting-started.md) — basic sanitization usage
- [API Reference](./api-reference.md) — full reference for all exports
