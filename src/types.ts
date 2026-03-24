/**
 * TypeScript types matching the W3C Sanitizer API spec dictionaries.
 * @see https://wicg.github.io/sanitizer-api/#config
 */

export interface SanitizerElementNamespace {
  name: string;
  namespace: string | null;
}

export interface SanitizerElementNamespaceWithAttributes
  extends SanitizerElementNamespace {
  attributes?: SanitizerAttributeNamespace[];
  removeAttributes?: SanitizerAttributeNamespace[];
}

export type SanitizerElement = string | SanitizerElementNamespace;

export type SanitizerElementWithAttributes =
  | string
  | SanitizerElementNamespaceWithAttributes;

export interface SanitizerAttributeNamespace {
  name: string;
  namespace: string | null;
}

export type SanitizerAttribute = string | SanitizerAttributeNamespace;

export interface SanitizerConfig {
  elements?: SanitizerElementWithAttributes[];
  removeElements?: SanitizerElement[];
  replaceWithChildrenElements?: SanitizerElement[];

  attributes?: SanitizerAttribute[];
  removeAttributes?: SanitizerAttribute[];

  comments?: boolean;
  dataAttributes?: boolean;
}

export type SanitizerPresets = "default";

export interface SetHTMLOptions {
  sanitizer?: SanitizerPresets | SanitizerConfig;
}

export interface SetHTMLUnsafeOptions {
  sanitizer?: SanitizerPresets | SanitizerConfig;
}

/** Internal canonical form — always has namespace resolved */
export interface CanonicalName {
  name: string;
  namespace: string | null;
}

export interface CanonicalElementWithAttributes extends CanonicalName {
  attributes?: CanonicalName[];
  removeAttributes?: CanonicalName[];
}

export interface CanonicalConfig {
  elements?: CanonicalElementWithAttributes[];
  removeElements?: CanonicalName[];
  replaceWithChildrenElements?: CanonicalName[];

  attributes?: CanonicalName[];
  removeAttributes?: CanonicalName[];

  comments: boolean;
  dataAttributes?: boolean;
}
