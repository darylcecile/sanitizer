/**
 * @darylcecile/sanitizer
 *
 * A server-safe (SSR-safe) HTML Sanitizer following the W3C Sanitizer API spec.
 * Zero dependencies. Works with Bun, Node, Deno, or any JS runtime.
 *
 * @see https://wicg.github.io/sanitizer-api
 * @module
 */

export { Sanitizer } from "./sanitizer.ts";
export { sanitize, sanitizeUnsafe } from "./sanitize.ts";
export type { SanitizeOptions } from "./sanitize.ts";

export type {
  SanitizerConfig,
  SanitizerElement,
  SanitizerElementWithAttributes,
  SanitizerAttribute,
  SanitizerElementNamespace,
  SanitizerElementNamespaceWithAttributes,
  SanitizerAttributeNamespace,
  SanitizerPresets,
  SetHTMLOptions,
  SetHTMLUnsafeOptions,
} from "./types.ts";

// Re-export built-in configs for advanced usage
export {
  BUILT_IN_SAFE_DEFAULT_CONFIG,
  BUILT_IN_SAFE_BASELINE_CONFIG,
} from "./defaults.ts";

// HTML parser & serializer for direct AST manipulation
export { parseHTML, Parser } from "./parser.ts";
export { serialize } from "./serializer.ts";

// AST node types and utilities
export {
  NodeType,
  createDocument,
  createElement,
  createText,
  createComment,
  createDocumentType,
  appendChild,
  removeChild,
  replaceWithChildren,
} from "./ast.ts";

export type {
  DocumentNode,
  ElementNode,
  TextNode,
  CommentNode,
  DocumentTypeNode,
  ChildNode,
  ParentNode,
  Attribute,
} from "./ast.ts";
