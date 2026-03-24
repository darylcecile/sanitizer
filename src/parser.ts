/**
 * HTML tokenizer + tree builder.
 * Parses HTML strings into our AST. Handles void elements, raw text,
 * attributes, comments, doctypes, and basic implicit tag closing.
 */

import {
  type DocumentNode,
  type ParentNode,
  type ElementNode,
  NodeType,
  createDocument,
  createElement,
  createText,
  createComment,
  createDocumentType,
  appendChild,
} from "./ast.ts";
import {
  HTML_NAMESPACE,
  SVG_NAMESPACE,
  MATHML_NAMESPACE,
  VOID_ELEMENTS,
  RAW_TEXT_ELEMENTS,
  ESCAPABLE_RAW_TEXT_ELEMENTS,
} from "./constants.ts";

/**
 * Parse an HTML string into a DocumentNode AST.
 */
export function parseHTML(html: string): DocumentNode {
  const doc = createDocument();
  const parser = new Parser(html, doc);
  parser.parse();
  return doc;
}

// Elements that auto-close when another of the same type opens
const AUTO_CLOSE_SIBLINGS: Record<string, Set<string>> = {
  p: new Set([
    "address", "article", "aside", "blockquote", "details", "div", "dl",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
    "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol",
    "p", "pre", "search", "section", "table", "ul",
  ]),
  li: new Set(["li"]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
  th: new Set(["td", "th"]),
  td: new Set(["td", "th"]),
  tr: new Set(["tr"]),
  thead: new Set(["tbody", "tfoot"]),
  tbody: new Set(["tbody", "tfoot"]),
  tfoot: new Set(["tbody"]),
  option: new Set(["option"]),
  optgroup: new Set(["optgroup"]),
  rt: new Set(["rt", "rp"]),
  rp: new Set(["rt", "rp"]),
};

export class Parser {
  private pos = 0;
  private readonly html: string;
  private readonly doc: DocumentNode;
  private current: ParentNode;
  private namespaceStack: string[];

  constructor(html: string, doc: DocumentNode) {
    this.html = html;
    this.doc = doc;
    this.current = doc;
    this.namespaceStack = [HTML_NAMESPACE];
  }

  private get currentNamespace(): string {
    return this.namespaceStack[this.namespaceStack.length - 1]!;
  }

  parse(): void {
    while (this.pos < this.html.length) {
      if (this.html[this.pos] === "<") {
        this.parseTag();
      } else {
        this.parseText();
      }
    }
  }

  private parseText(): void {
    const start = this.pos;
    while (this.pos < this.html.length && this.html[this.pos] !== "<") {
      this.pos++;
    }
    const text = this.html.slice(start, this.pos);
    if (text) {
      appendChild(this.current, createText(decodeEntities(text)));
    }
  }

  private parseTag(): void {
    // We're at '<'
    if (this.html.startsWith("<!--", this.pos)) {
      this.parseComment();
      return;
    }

    if (this.html.startsWith("<!", this.pos)) {
      this.parseDoctype();
      return;
    }

    if (this.html.startsWith("</", this.pos)) {
      this.parseClosingTag();
      return;
    }

    this.parseOpeningTag();
  }

  private parseComment(): void {
    // Skip '<!--'
    this.pos += 4;
    const end = this.html.indexOf("-->", this.pos);
    const value =
      end === -1
        ? this.html.slice(this.pos, (this.pos = this.html.length))
        : this.html.slice(this.pos, (this.pos = end + 3) - 3);
    appendChild(this.current, createComment(value));
  }

  private parseDoctype(): void {
    // Skip '<!'
    this.pos += 2;
    const end = this.html.indexOf(">", this.pos);
    if (end === -1) {
      this.pos = this.html.length;
      return;
    }
    const content = this.html.slice(this.pos, end).trim();
    this.pos = end + 1;

    if (/^doctype\s/i.test(content)) {
      const name = content.replace(/^doctype\s+/i, "").split(/\s/)[0] ?? "html";
      appendChild(this.current, createDocumentType(name));
    }
  }

  private parseClosingTag(): void {
    // Skip '</'
    this.pos += 2;
    const end = this.html.indexOf(">", this.pos);
    if (end === -1) {
      this.pos = this.html.length;
      return;
    }
    const tagName = this.html.slice(this.pos, end).trim().toLowerCase();
    this.pos = end + 1;

    if (!tagName) return;

    // Walk up the tree to find the matching open element
    let node: ParentNode | null = this.current;
    while (node && node.type !== NodeType.Document) {
      const el = node as ElementNode;
      if (el.tagName === tagName) {
        // Pop namespace if it was a foreign element
        if (
          el.namespace === SVG_NAMESPACE ||
          el.namespace === MATHML_NAMESPACE
        ) {
          this.namespaceStack.pop();
        }
        this.current = el.parent ?? this.doc;
        return;
      }
      node = el.parent;
    }
    // No matching open tag found — ignore the closing tag
  }

  private parseOpeningTag(): void {
    // Skip '<'
    this.pos++;
    const tagStart = this.pos;

    // Read tag name
    while (
      this.pos < this.html.length &&
      this.html[this.pos] !== " " &&
      this.html[this.pos] !== "\t" &&
      this.html[this.pos] !== "\n" &&
      this.html[this.pos] !== "\r" &&
      this.html[this.pos] !== ">" &&
      this.html[this.pos] !== "/" &&
      this.html[this.pos] !== "'"  &&
      this.html[this.pos] !== '"'
    ) {
      this.pos++;
    }

    const tagName = this.html.slice(tagStart, this.pos).toLowerCase();
    if (!tagName) {
      // Malformed tag — treat '<' as text
      appendChild(this.current, createText("<"));
      return;
    }

    // Determine namespace
    let ns = this.currentNamespace;
    if (tagName === "svg") {
      ns = SVG_NAMESPACE;
    } else if (tagName === "math") {
      ns = MATHML_NAMESPACE;
    } else if (
      ns === SVG_NAMESPACE &&
      tagName === "foreignobject"
    ) {
      ns = HTML_NAMESPACE;
    } else if (ns !== HTML_NAMESPACE) {
      // Stay in foreign namespace for children
    } else {
      ns = HTML_NAMESPACE;
    }

    // Handle auto-closing: an open ancestor closes when this tag opens.
    // AUTO_CLOSE_SIBLINGS[ancestor] = set of tags that cause ancestor to close.
    if (this.current.type === NodeType.Element) {
      let ancestor: ParentNode | null = this.current;
      while (ancestor && ancestor.type === NodeType.Element) {
        const ancestorTag = (ancestor as ElementNode).tagName;
        const closedBy = AUTO_CLOSE_SIBLINGS[ancestorTag];
        if (closedBy && closedBy.has(tagName)) {
          this.current = ancestor.parent ?? this.doc;
          break;
        }
        ancestor = ancestor.parent;
      }
    }

    // Parse attributes
    const attributes = this.parseAttributes();

    // Check for self-closing '/>'
    this.skipWhitespace();
    let selfClosing = false;
    if (this.pos < this.html.length && this.html[this.pos] === "/") {
      selfClosing = true;
      this.pos++;
    }
    if (this.pos < this.html.length && this.html[this.pos] === ">") {
      this.pos++;
    }

    const element = createElement(tagName, ns, attributes);
    appendChild(this.current, element);

    const isVoid = VOID_ELEMENTS.has(tagName) && ns === HTML_NAMESPACE;

    // Handle raw text elements (<script>, <style>)
    if (
      (RAW_TEXT_ELEMENTS.has(tagName) ||
        ESCAPABLE_RAW_TEXT_ELEMENTS.has(tagName)) &&
      ns === HTML_NAMESPACE &&
      !selfClosing
    ) {
      this.parseRawText(element, tagName);
      return;
    }

    if (!isVoid && !selfClosing) {
      // Push namespace for foreign content
      if (ns === SVG_NAMESPACE || ns === MATHML_NAMESPACE) {
        if (this.currentNamespace !== ns) {
          this.namespaceStack.push(ns);
        }
      }
      this.current = element;
    }
  }

  private parseAttributes(): Array<{
    name: string;
    value: string;
    namespace: string | null;
  }> {
    const attrs: Array<{
      name: string;
      value: string;
      namespace: string | null;
    }> = [];

    while (this.pos < this.html.length) {
      this.skipWhitespace();

      if (
        this.pos >= this.html.length ||
        this.html[this.pos] === ">" ||
        this.html[this.pos] === "/"
      ) {
        break;
      }

      // Read attribute name
      const nameStart = this.pos;
      while (
        this.pos < this.html.length &&
        this.html[this.pos] !== "=" &&
        this.html[this.pos] !== " " &&
        this.html[this.pos] !== "\t" &&
        this.html[this.pos] !== "\n" &&
        this.html[this.pos] !== "\r" &&
        this.html[this.pos] !== ">" &&
        this.html[this.pos] !== "/"
      ) {
        this.pos++;
      }

      const name = this.html.slice(nameStart, this.pos).toLowerCase();
      if (!name) break;

      this.skipWhitespace();

      let value = "";
      if (this.pos < this.html.length && this.html[this.pos] === "=") {
        this.pos++; // skip '='
        this.skipWhitespace();
        value = this.parseAttributeValue();
      }

      attrs.push({ name, value, namespace: null });
    }

    return attrs;
  }

  private parseAttributeValue(): string {
    if (this.pos >= this.html.length) return "";

    const quote = this.html[this.pos];
    if (quote === '"' || quote === "'") {
      this.pos++; // skip opening quote
      const start = this.pos;
      while (this.pos < this.html.length && this.html[this.pos] !== quote) {
        this.pos++;
      }
      const value = this.html.slice(start, this.pos);
      if (this.pos < this.html.length) this.pos++; // skip closing quote
      return decodeEntities(value);
    }

    // Unquoted value
    const start = this.pos;
    while (
      this.pos < this.html.length &&
      this.html[this.pos] !== " " &&
      this.html[this.pos] !== "\t" &&
      this.html[this.pos] !== "\n" &&
      this.html[this.pos] !== "\r" &&
      this.html[this.pos] !== ">" &&
      this.html[this.pos] !== "/"
    ) {
      this.pos++;
    }
    return decodeEntities(this.html.slice(start, this.pos));
  }

  private parseRawText(element: ElementNode, tagName: string): void {
    const closeTag = `</${tagName}`;
    const start = this.pos;

    while (this.pos < this.html.length) {
      const idx = this.html.toLowerCase().indexOf(closeTag, this.pos);
      if (idx === -1) {
        // No closing tag — consume rest as raw text
        appendChild(this.current, createText(this.html.slice(start)));
        this.pos = this.html.length;
        this.current = element;
        return;
      }

      // Verify the character after the close tag name is '>' or whitespace
      const afterTag = idx + closeTag.length;
      if (
        afterTag >= this.html.length ||
        this.html[afterTag] === ">" ||
        /\s/.test(this.html[afterTag]!)
      ) {
        const text = this.html.slice(start, idx);
        if (text) {
          appendChild(element, createText(text));
        }
        // Skip past closing tag
        const endBracket = this.html.indexOf(">", afterTag);
        this.pos = endBracket === -1 ? this.html.length : endBracket + 1;
        return;
      }

      this.pos = afterTag;
    }

    // Reached end without closing tag
    const text = this.html.slice(start);
    if (text) {
      appendChild(element, createText(text));
    }
    this.current = element;
  }

  private skipWhitespace(): void {
    while (
      this.pos < this.html.length &&
      (this.html[this.pos] === " " ||
        this.html[this.pos] === "\t" ||
        this.html[this.pos] === "\n" ||
        this.html[this.pos] === "\r")
    ) {
      this.pos++;
    }
  }
}

// Basic HTML entity decoding
const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": "\u00A0",
  "&#x2F;": "/",
  "&#47;": "/",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));?/g,
    (match, hex: string | undefined, dec: string | undefined) => {
      if (hex) {
        const code = parseInt(hex, 16);
        return code ? String.fromCodePoint(code) : match;
      }
      if (dec) {
        const code = parseInt(dec, 10);
        return code ? String.fromCodePoint(code) : match;
      }
      return ENTITY_MAP[match] ?? match;
    },
  );
}
