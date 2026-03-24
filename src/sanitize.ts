/**
 * Core sanitization algorithm.
 * Parses HTML → walks AST → filters elements/attributes → serializes back.
 * @see https://wicg.github.io/sanitizer-api/#sanitization
 */

import type { SanitizerConfig, SanitizerPresets, CanonicalConfig, CanonicalName, CanonicalElementWithAttributes } from "./types.ts";
import { Sanitizer } from "./sanitizer.ts";
import {
  canonicalizeConfig,
  isValidConfig,
  removeUnsafe,
  nameEquals,
  listContains,
  deepCloneConfig,
} from "./config.ts";
import { BUILT_IN_SAFE_DEFAULT_CONFIG } from "./defaults.ts";
import { parseHTML } from "./parser.ts";
import { serialize } from "./serializer.ts";
import {
  type DocumentNode,
  type ElementNode,
  type ChildNode,
  type ParentNode,
  NodeType,
  removeChild,
  replaceWithChildren,
} from "./ast.ts";
import {
  HTML_NAMESPACE,
  MATHML_NAMESPACE,
  XLINK_NAMESPACE,
  NAVIGATING_URL_ATTRIBUTES,
  ANIMATING_URL_ATTRIBUTES,
} from "./constants.ts";

export interface SanitizeOptions {
  /** Sanitizer instance, config dictionary, or preset name. */
  sanitizer?: Sanitizer | SanitizerConfig | SanitizerPresets;
  /**
   * If true, applies safe defaults (removes script-executing content).
   * If false, uses the configuration as-is.
   * @default true
   */
  safe?: boolean;
}

/**
 * Sanitize an HTML string and return the sanitized HTML.
 *
 * @param html - The HTML string to sanitize.
 * @param options - Optional sanitizer configuration.
 * @returns The sanitized HTML string.
 *
 * @example
 * ```ts
 * import { sanitize } from "@darylcecile/sanitizer";
 *
 * // Safe by default — strips scripts, event handlers, etc.
 * sanitize('<div onclick="alert(1)">Hello</div>');
 * // → '<div>Hello</div>'
 *
 * // Custom config
 * sanitize('<b><i>text</i></b>', { sanitizer: { elements: ["b"] } });
 * // → '<b>text</b>'
 * ```
 */
export function sanitize(html: string, options?: SanitizeOptions): string {
  const safe = options?.safe ?? true;
  const sanitizer = resolveSanitizer(options?.sanitizer, safe);

  const doc = parseHTML(html);
  sanitizeNode(doc, sanitizer, safe);
  return serialize(doc);
}

/**
 * Sanitize HTML without safety guarantees (no implicit removeUnsafe).
 * Equivalent to the spec's "unsafe" methods.
 */
export function sanitizeUnsafe(
  html: string,
  options?: Omit<SanitizeOptions, "safe">,
): string {
  return sanitize(html, { ...options, safe: false });
}

// --- Internal ---

function resolveSanitizer(
  spec: Sanitizer | SanitizerConfig | SanitizerPresets | undefined,
  safe: boolean,
): CanonicalConfig {
  if (spec instanceof Sanitizer) {
    return deepCloneConfig(spec._configuration);
  }

  if (spec === "default" || (spec === undefined && safe)) {
    return deepCloneConfig(BUILT_IN_SAFE_DEFAULT_CONFIG);
  }

  if (spec === undefined) {
    // Unsafe with no config = allow everything
    return {
      removeElements: [],
      removeAttributes: [],
      comments: true,
    };
  }

  // It's a SanitizerConfig dictionary
  const canonical = canonicalizeConfig(spec, !safe);
  if (!isValidConfig(canonical)) {
    throw new TypeError("Invalid SanitizerConfig");
  }
  return canonical;
}

/**
 * Main sanitize algorithm.
 * @see https://wicg.github.io/sanitizer-api/#sanitize
 */
function sanitizeNode(
  node: ParentNode,
  config: CanonicalConfig,
  safe: boolean,
): void {
  let effectiveConfig = config;
  if (safe) {
    effectiveConfig = removeUnsafe(config);
  }
  sanitizeCore(node, effectiveConfig, safe);
}

/**
 * Core recursive sanitize.
 * @see https://wicg.github.io/sanitizer-api/#sanitize-core
 */
function sanitizeCore(
  node: ParentNode,
  config: CanonicalConfig,
  handleJavascriptNavigationUrls: boolean,
): void {
  // Must iterate over a copy since we may modify children
  const children = [...node.children];

  for (const child of children) {
    // DocumentType — skip (continue)
    if (child.type === NodeType.DocumentType) continue;

    // Text — skip (continue)
    if (child.type === NodeType.Text) continue;

    // Comment
    if (child.type === NodeType.Comment) {
      if (config.comments !== true) {
        removeChild(node, child);
      }
      continue;
    }

    // Element
    const element = child as ElementNode;
    const elementName: CanonicalName = {
      name: element.tagName,
      namespace: element.namespace,
    };

    // Check replaceWithChildrenElements
    if (
      config.replaceWithChildrenElements &&
      listContains(config.replaceWithChildrenElements, elementName)
    ) {
      sanitizeCore(element, config, handleJavascriptNavigationUrls);
      replaceWithChildren(node, element);
      continue;
    }

    // Check element allow/remove lists
    if (config.elements) {
      if (!listContains(config.elements, elementName)) {
        removeChild(node, element);
        continue;
      }
    } else if (config.removeElements) {
      if (listContains(config.removeElements, elementName)) {
        removeChild(node, element);
        continue;
      }
    }

    // Find per-element attribute config
    let elementWithLocalAttributes: CanonicalElementWithAttributes = {
      name: "",
      namespace: null,
    };
    if (config.elements && listContains(config.elements, elementName)) {
      const found = config.elements.find((e) => nameEquals(e, elementName));
      if (found) {
        elementWithLocalAttributes = found as CanonicalElementWithAttributes;
      }
    }

    // Filter attributes
    const attrsToRemove: number[] = [];
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]!;
      const attrName: CanonicalName = {
        name: attr.name,
        namespace: attr.namespace,
      };

      // Check local removeAttributes
      if (
        elementWithLocalAttributes.removeAttributes &&
        listContains(elementWithLocalAttributes.removeAttributes, attrName)
      ) {
        attrsToRemove.push(i);
        continue;
      }

      // Check global attributes (allow-list mode)
      if (config.attributes) {
        const inGlobalAllow = listContains(config.attributes, attrName);
        const inLocalAllow =
          elementWithLocalAttributes.attributes &&
          listContains(elementWithLocalAttributes.attributes, attrName);
        const isDataAttr =
          attr.name.startsWith("data-") && attr.namespace === null;

        if (!inGlobalAllow && !inLocalAllow) {
          if (!(isDataAttr && config.dataAttributes === true)) {
            attrsToRemove.push(i);
            continue;
          }
        }
      } else {
        // removeAttributes (remove-list) mode
        if (elementWithLocalAttributes.attributes) {
          // Local allow-list takes precedence
          if (
            !listContains(elementWithLocalAttributes.attributes, attrName)
          ) {
            attrsToRemove.push(i);
            continue;
          }
        } else if (
          config.removeAttributes &&
          listContains(config.removeAttributes, attrName)
        ) {
          attrsToRemove.push(i);
          continue;
        }
      }

      // Handle javascript: navigation URLs
      if (handleJavascriptNavigationUrls) {
        if (shouldRemoveJavascriptUrl(element, attr, attrName, elementName)) {
          attrsToRemove.push(i);
          continue;
        }
      }
    }

    // Remove attributes in reverse order
    for (let i = attrsToRemove.length - 1; i >= 0; i--) {
      element.attributes.splice(attrsToRemove[i]!, 1);
    }

    // Handle <template> content (process children as template contents)
    // For SSR, we just process children normally

    // Recurse into children
    sanitizeCore(element, config, handleJavascriptNavigationUrls);
  }
}

function shouldRemoveJavascriptUrl(
  element: ElementNode,
  attr: { name: string; value: string; namespace: string | null },
  attrName: CanonicalName,
  elementName: CanonicalName,
): boolean {
  // Check navigating URL attributes
  for (const [elSpec, attrSpec] of NAVIGATING_URL_ATTRIBUTES) {
    if (
      elementName.name === elSpec.name &&
      elementName.namespace === elSpec.namespace &&
      attrName.name === attrSpec.name
    ) {
      if (containsJavascriptUrl(attr.value)) return true;
    }
  }

  // Check MathML href
  if (
    element.namespace === MATHML_NAMESPACE &&
    attr.name === "href" &&
    (attr.namespace === null || attr.namespace === XLINK_NAMESPACE)
  ) {
    if (containsJavascriptUrl(attr.value)) return true;
  }

  // Check animating URL attributes
  for (const [elSpec, attrSpec] of ANIMATING_URL_ATTRIBUTES) {
    if (
      elementName.name === elSpec.name &&
      elementName.namespace === elSpec.namespace &&
      attrName.name === attrSpec.name
    ) {
      if (attr.value === "href" || attr.value === "xlink:href") return true;
    }
  }

  return false;
}

function containsJavascriptUrl(value: string): boolean {
  try {
    const url = new URL(value, "http://localhost");
    return url.protocol === "javascript:";
  } catch {
    // If URL parsing fails, also check raw value
    return /^\s*javascript\s*:/i.test(value);
  }
}
