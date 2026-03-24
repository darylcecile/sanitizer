/**
 * AST node types for the HTML parser.
 * Lightweight DOM-like tree without browser dependencies.
 */

export enum NodeType {
  Document = 0,
  Element = 1,
  Text = 3,
  Comment = 8,
  DocumentType = 10,
}

export interface Attribute {
  name: string;
  value: string;
  namespace: string | null;
}

export interface BaseNode {
  type: NodeType;
  parent: ParentNode | null;
}

export interface DocumentNode extends BaseNode {
  type: NodeType.Document;
  children: ChildNode[];
}

export interface ElementNode extends BaseNode {
  type: NodeType.Element;
  tagName: string;
  namespace: string;
  attributes: Attribute[];
  children: ChildNode[];
}

export interface TextNode extends BaseNode {
  type: NodeType.Text;
  value: string;
}

export interface CommentNode extends BaseNode {
  type: NodeType.Comment;
  value: string;
}

export interface DocumentTypeNode extends BaseNode {
  type: NodeType.DocumentType;
  name: string;
  publicId: string;
  systemId: string;
}

export type ChildNode =
  | ElementNode
  | TextNode
  | CommentNode
  | DocumentTypeNode;
export type ParentNode = DocumentNode | ElementNode;

// Factory functions

export function createDocument(): DocumentNode {
  return { type: NodeType.Document, children: [], parent: null };
}

export function createElement(
  tagName: string,
  namespace: string,
  attributes: Attribute[] = [],
): ElementNode {
  return {
    type: NodeType.Element,
    tagName,
    namespace,
    attributes,
    children: [],
    parent: null,
  };
}

export function createText(value: string): TextNode {
  return { type: NodeType.Text, value, parent: null };
}

export function createComment(value: string): CommentNode {
  return { type: NodeType.Comment, value, parent: null };
}

export function createDocumentType(
  name: string,
  publicId = "",
  systemId = "",
): DocumentTypeNode {
  return { type: NodeType.DocumentType, name, publicId, systemId, parent: null };
}

export function appendChild(parent: ParentNode, child: ChildNode): void {
  child.parent = parent;
  parent.children.push(child);
}

export function removeChild(parent: ParentNode, child: ChildNode): void {
  const idx = parent.children.indexOf(child);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
    child.parent = null;
  }
}

export function replaceWithChildren(
  parent: ParentNode,
  element: ElementNode,
): void {
  const idx = parent.children.indexOf(element);
  if (idx === -1) return;
  const children = element.children.slice();
  for (const child of children) {
    child.parent = parent;
  }
  parent.children.splice(idx, 1, ...children);
  element.parent = null;
}
