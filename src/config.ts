/**
 * Configuration canonicalization, validation, and removeUnsafe algorithms.
 * Follows the W3C Sanitizer API spec algorithms.
 * @see https://wicg.github.io/sanitizer-api/#configuration-canonicalize
 */

import type {
  SanitizerConfig,
  SanitizerElement,
  SanitizerElementWithAttributes,
  SanitizerAttribute,
  CanonicalConfig,
  CanonicalName,
  CanonicalElementWithAttributes,
} from "./types.ts";
import { HTML_NAMESPACE, EVENT_HANDLER_ATTRIBUTES } from "./constants.ts";
import { BUILT_IN_SAFE_BASELINE_CONFIG } from "./defaults.ts";

// --- Name comparison helpers ---

export function nameEquals(a: CanonicalName, b: CanonicalName): boolean {
  return a.name === b.name && a.namespace === b.namespace;
}

export function listContains(
  list: CanonicalName[],
  item: CanonicalName,
): boolean {
  return list.some((entry) => nameEquals(entry, item));
}

export function listRemove(
  list: CanonicalName[],
  item: CanonicalName,
): boolean {
  let removed = false;
  for (let i = list.length - 1; i >= 0; i--) {
    if (nameEquals(list[i]!, item)) {
      list.splice(i, 1);
      removed = true;
    }
  }
  return removed;
}

export function listAdd(list: CanonicalName[], item: CanonicalName): void {
  if (!listContains(list, item)) {
    list.push(item);
  }
}

function hasDuplicates(list: CanonicalName[]): boolean {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (nameEquals(list[i]!, list[j]!)) return true;
    }
  }
  return false;
}

function isCustomDataAttribute(name: CanonicalName): boolean {
  return name.namespace === null && name.name.startsWith("data-");
}

function nameLessThan(a: CanonicalName, b: CanonicalName): number {
  if (a.namespace === null) {
    if (b.namespace !== null) return -1;
  } else {
    if (b.namespace === null) return 1;
    if (a.namespace < b.namespace) return -1;
    if (a.namespace > b.namespace) return 1;
  }
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

// --- Canonicalization ---

export function canonicalizeName(
  name: SanitizerElement | SanitizerAttribute,
  defaultNamespace: string | null,
): CanonicalName {
  if (typeof name === "string") {
    return { name, namespace: defaultNamespace };
  }
  return {
    name: name.name,
    namespace: name.namespace === "" ? null : (name.namespace ?? defaultNamespace),
  };
}

export function canonicalizeElement(name: SanitizerElement): CanonicalName {
  return canonicalizeName(name, HTML_NAMESPACE);
}

export function canonicalizeAttribute(name: SanitizerAttribute): CanonicalName {
  return canonicalizeName(name, null);
}

export function canonicalizeElementWithAttributes(
  element: SanitizerElementWithAttributes,
): CanonicalElementWithAttributes {
  const base = canonicalizeElement(element);
  const result: CanonicalElementWithAttributes = { ...base };

  if (typeof element === "object" && "attributes" in element && element.attributes) {
    result.attributes = element.attributes.map(canonicalizeAttribute);
  }
  if (typeof element === "object" && "removeAttributes" in element && element.removeAttributes) {
    result.removeAttributes = element.removeAttributes.map(canonicalizeAttribute);
  }

  // Per spec: if neither attributes nor removeAttributes exist, set removeAttributes to empty
  if (!result.attributes && !result.removeAttributes) {
    result.removeAttributes = [];
  }

  return result;
}

/**
 * Canonicalize a SanitizerConfig dictionary.
 * @see https://wicg.github.io/sanitizer-api/#configuration-canonicalize
 */
export function canonicalizeConfig(
  config: SanitizerConfig,
  allowCommentsAndDataAttributes: boolean,
): CanonicalConfig {
  const result: CanonicalConfig = { comments: false };

  // Step 1: If neither elements nor removeElements exist, set removeElements to empty
  if (!config.elements && !config.removeElements) {
    result.removeElements = [];
  }
  // Step 2: If neither attributes nor removeAttributes exist, set removeAttributes to empty
  if (!config.attributes && !config.removeAttributes) {
    result.removeAttributes = [];
  }

  // Step 3: Canonicalize elements
  if (config.elements) {
    result.elements = config.elements.map((e) =>
      canonicalizeElementWithAttributes(e),
    );
  }
  // Step 4: Canonicalize removeElements
  if (config.removeElements) {
    result.removeElements = config.removeElements.map(canonicalizeElement);
  }
  // Step 5: Canonicalize replaceWithChildrenElements
  if (config.replaceWithChildrenElements) {
    result.replaceWithChildrenElements =
      config.replaceWithChildrenElements.map(canonicalizeElement);
  }
  // Step 6: Canonicalize attributes
  if (config.attributes) {
    result.attributes = config.attributes.map(canonicalizeAttribute);
  }
  // Step 7: Canonicalize removeAttributes
  if (config.removeAttributes) {
    result.removeAttributes = config.removeAttributes.map(canonicalizeAttribute);
  }

  // Step 8: comments
  result.comments = config.comments ?? allowCommentsAndDataAttributes;

  // Step 9: dataAttributes
  if (result.attributes && config.dataAttributes === undefined) {
    result.dataAttributes = allowCommentsAndDataAttributes;
  } else if (config.dataAttributes !== undefined) {
    result.dataAttributes = config.dataAttributes;
  }

  return result;
}

/**
 * Validate a canonical configuration.
 * @see https://wicg.github.io/sanitizer-api/#invariants
 */
export function isValidConfig(config: CanonicalConfig): boolean {
  // Cannot have both elements and removeElements
  if (config.elements && config.removeElements) return false;
  // Must have one or the other
  if (!config.elements && !config.removeElements) return false;

  // Cannot have both attributes and removeAttributes
  if (config.attributes && config.removeAttributes) return false;
  // Must have one or the other
  if (!config.attributes && !config.removeAttributes) return false;

  // Check duplicates in element lists
  if (config.elements && hasDuplicates(config.elements)) return false;
  if (config.removeElements && hasDuplicates(config.removeElements)) return false;

  // Check duplicates in attribute lists
  if (config.attributes && hasDuplicates(config.attributes)) return false;
  if (config.removeAttributes && hasDuplicates(config.removeAttributes)) return false;

  // Check replaceWithChildrenElements
  if (config.replaceWithChildrenElements) {
    if (hasDuplicates(config.replaceWithChildrenElements)) return false;

    // Cannot contain <html>
    if (
      listContains(config.replaceWithChildrenElements, {
        name: "html",
        namespace: HTML_NAMESPACE,
      })
    )
      return false;

    // No overlap with elements or removeElements
    if (config.elements) {
      if (hasIntersection(config.elements, config.replaceWithChildrenElements))
        return false;
    } else if (config.removeElements) {
      if (
        hasIntersection(
          config.removeElements,
          config.replaceWithChildrenElements,
        )
      )
        return false;
    }
  }

  // Check per-element attribute constraints
  if (config.attributes) {
    // dataAttributes must exist when attributes exists
    if (config.elements) {
      for (const element of config.elements) {
        const ewAttrs = element as CanonicalElementWithAttributes;
        const localAttrs = ewAttrs.attributes ?? [];
        const localRemoveAttrs = ewAttrs.removeAttributes ?? [];

        if (hasDuplicates(localAttrs)) return false;
        if (hasDuplicates(localRemoveAttrs)) return false;

        // No overlap between global attributes and local attributes
        if (hasIntersection(config.attributes, localAttrs)) return false;

        // Local removeAttributes must be subset of global attributes
        for (const ra of localRemoveAttrs) {
          if (!listContains(config.attributes, ra)) return false;
        }

        // If dataAttributes is true, no custom data attributes in local allow-lists
        if (config.dataAttributes) {
          if (localAttrs.some(isCustomDataAttribute)) return false;
        }
      }
    }

    // If dataAttributes is true, no custom data attributes in global allow-list
    if (config.dataAttributes && config.attributes.some(isCustomDataAttribute))
      return false;
  } else {
    // removeAttributes mode
    if (config.elements) {
      for (const element of config.elements) {
        const ewAttrs = element as CanonicalElementWithAttributes;
        const localAttrs = ewAttrs.attributes ?? [];
        const localRemoveAttrs = ewAttrs.removeAttributes ?? [];

        // Cannot have both local allow and remove lists with a global remove list
        if (localAttrs.length > 0 && localRemoveAttrs.length > 0) return false;

        if (hasDuplicates(localAttrs)) return false;
        if (hasDuplicates(localRemoveAttrs)) return false;

        // No overlap between global removeAttributes and local lists
        if (config.removeAttributes) {
          if (hasIntersection(config.removeAttributes, localAttrs)) return false;
          if (hasIntersection(config.removeAttributes, localRemoveAttrs))
            return false;
        }
      }
    }

    // dataAttributes must not exist with removeAttributes mode
    if (config.dataAttributes !== undefined) return false;
  }

  return true;
}

function hasIntersection(a: CanonicalName[], b: CanonicalName[]): boolean {
  return a.some((item) => listContains(b, item));
}

/**
 * Remove unsafe elements and attributes from a configuration.
 * @see https://wicg.github.io/sanitizer-api/#sanitizerconfig-remove-unsafe
 */
export function removeUnsafe(config: CanonicalConfig): CanonicalConfig {
  const result = deepCloneConfig(config);

  // Remove unsafe elements from baseline
  for (const element of BUILT_IN_SAFE_BASELINE_CONFIG.removeElements ?? []) {
    removeElementFromConfig(element, result);
  }

  // Remove unsafe attributes from baseline
  for (const attribute of BUILT_IN_SAFE_BASELINE_CONFIG.removeAttributes ?? []) {
    removeAttributeFromConfig(attribute, result);
  }

  // Remove all event handler content attributes
  for (const handler of EVENT_HANDLER_ATTRIBUTES) {
    const attr: CanonicalName = { name: handler, namespace: null };
    removeAttributeFromConfig(attr, result);
  }

  return result;
}

/**
 * Remove an element from a config (used by removeUnsafe and Sanitizer.removeElement).
 */
export function removeElementFromConfig(
  element: CanonicalName,
  config: CanonicalConfig,
): boolean {
  let modified = false;

  // Remove from replaceWithChildrenElements if present
  if (config.replaceWithChildrenElements) {
    if (listRemove(config.replaceWithChildrenElements, element)) {
      modified = true;
    }
  }

  if (config.elements) {
    if (listContains(config.elements, element)) {
      listRemove(config.elements, element);
      return true;
    }
    return modified;
  }

  // removeElements mode
  if (config.removeElements) {
    if (listContains(config.removeElements, element)) {
      return modified;
    }
    listAdd(config.removeElements, element);
    return true;
  }

  return modified;
}

/**
 * Remove an attribute from a config (used by removeUnsafe and Sanitizer.removeAttribute).
 */
export function removeAttributeFromConfig(
  attribute: CanonicalName,
  config: CanonicalConfig,
): boolean {
  if (config.attributes) {
    let modified = listRemove(config.attributes, attribute);

    // Fix-up per-element lists
    if (config.elements) {
      for (const element of config.elements) {
        const ewa = element as CanonicalElementWithAttributes;
        if (ewa.attributes && listContains(ewa.attributes, attribute)) {
          modified = true;
          listRemove(ewa.attributes, attribute);
        }
        if (
          ewa.removeAttributes &&
          listContains(ewa.removeAttributes, attribute)
        ) {
          listRemove(ewa.removeAttributes, attribute);
        }
      }
    }

    return modified;
  }

  // removeAttributes mode
  if (config.removeAttributes) {
    if (listContains(config.removeAttributes, attribute)) return false;

    // Fix-up per-element lists
    if (config.elements) {
      for (const element of config.elements) {
        const ewa = element as CanonicalElementWithAttributes;
        if (ewa.attributes && listContains(ewa.attributes, attribute)) {
          listRemove(ewa.attributes, attribute);
        }
        if (
          ewa.removeAttributes &&
          listContains(ewa.removeAttributes, attribute)
        ) {
          listRemove(ewa.removeAttributes, attribute);
        }
      }
    }

    config.removeAttributes.push(attribute);
    return true;
  }

  return false;
}

/**
 * Sort a config for output (used by Sanitizer.get()).
 */
export function sortConfig(config: CanonicalConfig): CanonicalConfig {
  const result = deepCloneConfig(config);

  if (result.elements) {
    for (const el of result.elements) {
      const ewa = el as CanonicalElementWithAttributes;
      if (ewa.attributes) {
        ewa.attributes.sort(nameLessThan);
      }
      if (ewa.removeAttributes) {
        ewa.removeAttributes.sort(nameLessThan);
      }
    }
    result.elements.sort(nameLessThan);
  }
  if (result.removeElements) {
    result.removeElements.sort(nameLessThan);
  }
  if (result.replaceWithChildrenElements) {
    result.replaceWithChildrenElements.sort(nameLessThan);
  }
  if (result.attributes) {
    result.attributes.sort(nameLessThan);
  }
  if (result.removeAttributes) {
    result.removeAttributes.sort(nameLessThan);
  }

  return result;
}

export function deepCloneConfig(config: CanonicalConfig): CanonicalConfig {
  return JSON.parse(JSON.stringify(config));
}
