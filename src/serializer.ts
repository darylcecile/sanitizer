/**
 * AST → HTML string serializer.
 * Handles void elements, attribute quoting, text escaping.
 */

import {
  type DocumentNode,
  type ElementNode,
  type ChildNode,
  type ParentNode,
  NodeType,
} from "./ast.ts";
import { VOID_ELEMENTS, RAW_TEXT_ELEMENTS, ESCAPABLE_RAW_TEXT_ELEMENTS, HTML_NAMESPACE } from "./constants.ts";

/**
 * Serialize an AST node tree back to an HTML string.
 */
export function serialize(node: DocumentNode | ElementNode): string {
  const parts: string[] = [];
  serializeChildren(node, parts);
  return parts.join("");
}

function serializeChildren(node: ParentNode, parts: string[]): void {
  for (const child of node.children) {
    serializeNode(child, parts);
  }
}

function serializeNode(node: ChildNode, parts: string[]): void {
  switch (node.type) {
    case NodeType.Text:
      // Check if parent is a raw text element
      if (
        node.parent &&
        node.parent.type === NodeType.Element &&
        (RAW_TEXT_ELEMENTS.has(node.parent.tagName) ||
          ESCAPABLE_RAW_TEXT_ELEMENTS.has(node.parent.tagName)) &&
        node.parent.namespace === HTML_NAMESPACE
      ) {
        parts.push(node.value);
      } else {
        parts.push(escapeText(node.value));
      }
      break;

    case NodeType.Comment:
      parts.push(`<!--${node.value}-->`);
      break;

    case NodeType.DocumentType:
      parts.push(`<!DOCTYPE ${node.name}>`);
      break;

    case NodeType.Element:
      serializeElement(node, parts);
      break;
  }
}

function serializeElement(el: ElementNode, parts: string[]): void {
  parts.push(`<${el.tagName}`);

  for (const attr of el.attributes) {
    parts.push(` ${attr.name}`);
    if (attr.value !== "") {
      parts.push(`="${escapeAttribute(attr.value)}"`);
    } else {
      // Boolean attribute with empty value — still serialize with =""
      // to be safe, but some boolean attrs can be valueless
      parts.push(`=""`);
    }
  }

  const isVoid = VOID_ELEMENTS.has(el.tagName) && el.namespace === HTML_NAMESPACE;

  if (isVoid) {
    parts.push(">");
    return;
  }

  parts.push(">");
  serializeChildren(el, parts);
  parts.push(`</${el.tagName}>`);
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
