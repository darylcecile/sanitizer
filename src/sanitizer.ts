/**
 * Sanitizer class — matches the W3C Sanitizer API interface.
 * @see https://wicg.github.io/sanitizer-api/#sanitizer-api
 */

import type {
  SanitizerConfig,
  SanitizerElement,
  SanitizerElementWithAttributes,
  SanitizerAttribute,
  CanonicalConfig,
  CanonicalName,
  CanonicalElementWithAttributes,
  SanitizerPresets,
} from "./types.ts";
import {
  canonicalizeConfig,
  canonicalizeElement,
  canonicalizeAttribute,
  canonicalizeElementWithAttributes,
  isValidConfig,
  removeUnsafe as removeUnsafeFromConfig,
  removeElementFromConfig,
  removeAttributeFromConfig,
  sortConfig,
  deepCloneConfig,
  nameEquals,
  listContains,
  listRemove,
  listAdd,
} from "./config.ts";
import { BUILT_IN_SAFE_DEFAULT_CONFIG } from "./defaults.ts";
import { HTML_NAMESPACE } from "./constants.ts";

export class Sanitizer {
  /** @internal */
  _configuration: CanonicalConfig;

  constructor(configuration?: SanitizerConfig | SanitizerPresets) {
    if (configuration === "default" || configuration === undefined) {
      this._configuration = deepCloneConfig(BUILT_IN_SAFE_DEFAULT_CONFIG);
      return;
    }

    const canonical = canonicalizeConfig(configuration, true);
    if (!isValidConfig(canonical)) {
      throw new TypeError("Invalid SanitizerConfig");
    }
    this._configuration = canonical;
  }

  /** Return the current configuration dictionary (sorted). */
  get(): SanitizerConfig {
    return sortConfig(this._configuration) as unknown as SanitizerConfig;
  }

  /** Allow an element (add to allow-list or remove from remove-list). */
  allowElement(element: SanitizerElementWithAttributes): boolean {
    const config = this._configuration;
    const canonEl = canonicalizeElementWithAttributes(element);

    if (config.elements) {
      let modified = false;
      if (config.replaceWithChildrenElements) {
        if (listRemove(config.replaceWithChildrenElements, canonEl)) {
          modified = true;
        }
      }

      // Handle per-element attribute fixups with global attribute lists
      if (config.attributes) {
        if (canonEl.attributes) {
          canonEl.attributes = removeDuplicates(canonEl.attributes);
          canonEl.attributes = difference(canonEl.attributes, config.attributes);
          if (config.dataAttributes) {
            canonEl.attributes = canonEl.attributes.filter(
              (a) => !isCustomDataAttribute(a),
            );
          }
        }
        if (canonEl.removeAttributes) {
          canonEl.removeAttributes = removeDuplicates(canonEl.removeAttributes);
          canonEl.removeAttributes = intersection(
            canonEl.removeAttributes,
            config.attributes,
          );
        }
      } else {
        // removeAttributes mode
        if (canonEl.attributes) {
          canonEl.attributes = removeDuplicates(canonEl.attributes);
          canonEl.attributes = difference(
            canonEl.attributes,
            canonEl.removeAttributes ?? [],
          );
          delete canonEl.removeAttributes;
          if (config.removeAttributes) {
            canonEl.attributes = difference(
              canonEl.attributes,
              config.removeAttributes,
            );
          }
        }
        if (canonEl.removeAttributes) {
          canonEl.removeAttributes = removeDuplicates(canonEl.removeAttributes);
          if (config.removeAttributes) {
            canonEl.removeAttributes = difference(
              canonEl.removeAttributes,
              config.removeAttributes,
            );
          }
        }
      }

      // Check if element already exists
      const existing = findElement(config.elements, canonEl);
      if (!existing) {
        config.elements.push(canonEl);
        return true;
      }

      if (elementEquals(existing, canonEl)) return modified;

      // Replace existing entry
      listRemove(config.elements, canonEl);
      config.elements.push(canonEl);
      return true;
    }

    // removeElements mode
    if (
      (canonEl.attributes && canonEl.attributes.length > 0) ||
      (canonEl.removeAttributes && canonEl.removeAttributes.length > 0)
    ) {
      return false;
    }

    let modified = false;
    if (config.replaceWithChildrenElements) {
      if (listRemove(config.replaceWithChildrenElements, canonEl)) {
        modified = true;
      }
    }

    if (config.removeElements && listContains(config.removeElements, canonEl)) {
      listRemove(config.removeElements, canonEl);
      return true;
    }

    return modified;
  }

  /** Remove an element. */
  removeElement(element: SanitizerElement): boolean {
    return removeElementFromConfig(
      canonicalizeElement(element),
      this._configuration,
    );
  }

  /** Replace an element with its children. */
  replaceElementWithChildren(element: SanitizerElement): boolean {
    const config = this._configuration;
    const canonEl = canonicalizeElement(element);

    // Cannot replace <html>
    if (canonEl.name === "html" && canonEl.namespace === HTML_NAMESPACE) {
      return false;
    }

    if (
      config.replaceWithChildrenElements &&
      listContains(config.replaceWithChildrenElements, canonEl)
    ) {
      return false;
    }

    // Remove from other lists
    if (config.removeElements) listRemove(config.removeElements, canonEl);
    if (config.elements) listRemove(config.elements, canonEl);

    if (!config.replaceWithChildrenElements) {
      config.replaceWithChildrenElements = [];
    }
    listAdd(config.replaceWithChildrenElements, canonEl);
    return true;
  }

  /** Allow an attribute globally. */
  allowAttribute(attribute: SanitizerAttribute): boolean {
    const config = this._configuration;
    const canonAttr = canonicalizeAttribute(attribute);

    if (config.attributes) {
      if (
        config.dataAttributes &&
        isCustomDataAttribute(canonAttr)
      ) {
        return false;
      }

      if (listContains(config.attributes, canonAttr)) return false;

      // Fix-up per-element lists
      if (config.elements) {
        for (const element of config.elements) {
          const ewa = element as CanonicalElementWithAttributes;
          if (ewa.attributes && listContains(ewa.attributes, canonAttr)) {
            listRemove(ewa.attributes, canonAttr);
          }
        }
      }

      config.attributes.push(canonAttr);
      return true;
    }

    // removeAttributes mode
    if (config.removeAttributes) {
      if (!listContains(config.removeAttributes, canonAttr)) return false;
      listRemove(config.removeAttributes, canonAttr);
      return true;
    }

    return false;
  }

  /** Remove an attribute globally. */
  removeAttribute(attribute: SanitizerAttribute): boolean {
    return removeAttributeFromConfig(
      canonicalizeAttribute(attribute),
      this._configuration,
    );
  }

  /** Set whether comments are allowed. */
  setComments(allow: boolean): boolean {
    const config = this._configuration;
    if (config.comments === allow) return false;
    config.comments = allow;
    return true;
  }

  /** Set whether data-* attributes are allowed. */
  setDataAttributes(allow: boolean): boolean {
    const config = this._configuration;
    if (!config.attributes) return false;
    if (config.dataAttributes === allow) return false;

    if (allow) {
      // Remove custom data attributes from allow lists (they're now implicitly allowed)
      config.attributes = config.attributes.filter(
        (a) => !isCustomDataAttribute(a),
      );
      if (config.elements) {
        for (const element of config.elements) {
          const ewa = element as CanonicalElementWithAttributes;
          if (ewa.attributes) {
            ewa.attributes = ewa.attributes.filter(
              (a) => !isCustomDataAttribute(a),
            );
          }
        }
      }
    }

    config.dataAttributes = allow;
    return true;
  }

  /** Remove all script-executing markup from the config. */
  removeUnsafe(): boolean {
    const before = JSON.stringify(this._configuration);
    this._configuration = removeUnsafeFromConfig(this._configuration);
    return JSON.stringify(this._configuration) !== before;
  }
}

// --- Helpers ---

function isCustomDataAttribute(name: CanonicalName): boolean {
  return name.namespace === null && name.name.startsWith("data-");
}

function removeDuplicates(list: CanonicalName[]): CanonicalName[] {
  const result: CanonicalName[] = [];
  for (const item of list) {
    if (!listContains(result, item)) {
      result.push(item);
    }
  }
  return result;
}

function difference(
  a: CanonicalName[],
  b: CanonicalName[],
): CanonicalName[] {
  return a.filter((item) => !listContains(b, item));
}

function intersection(
  a: CanonicalName[],
  b: CanonicalName[],
): CanonicalName[] {
  return a.filter((item) => listContains(b, item));
}

function findElement(
  list: CanonicalElementWithAttributes[],
  target: CanonicalName,
): CanonicalElementWithAttributes | undefined {
  return list.find((el) => el.name === target.name && el.namespace === target.namespace);
}

function elementEquals(
  a: CanonicalElementWithAttributes,
  b: CanonicalElementWithAttributes,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
