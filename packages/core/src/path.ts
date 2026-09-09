/**
 * Path resolution — addressing nodes below the top level.
 *
 * A `path` is an array of content indices from the document root:
 * `[2]` is `doc.content[2]`; `[2, 0, 1]` is
 * `doc.content[2].content[0].content[1]`. The selection model's
 * `SelectionPoint.path` uses this shape.
 *
 * Today every command treats `path` as length 1 — a top-level block
 * index. The deep selection model lets a path reach inside tables,
 * list items, and blockquotes. These pure helpers are step 1: they
 * resolve, transform, and classify nodes by path, without changing
 * what `pointFromDOM` produces or how any command behaves. Commands
 * migrate onto them one subsystem at a time.
 */

import type {
  DocumentNode,
  DocumentJSON,
  EditorSelection,
  SelectionPoint,
} from "./types.js";

// ============================================================================
// Classification
// ============================================================================

/** Node types that live in inline content. */
const INLINE_TYPES = new Set(["text", "hard_break", "mention"]);

/**
 * A leaf block holds inline content (a paragraph, heading, code
 * block) — the caret can sit inside it. A container block holds other
 * blocks (a table, list, list item, blockquote). An empty block is
 * treated as a leaf.
 */
export function isLeafBlock(node: DocumentNode): boolean {
  if (!node.content || node.content.length === 0) return true;
  return node.content.some((c) => INLINE_TYPES.has(c.type));
}

/** The inverse of {@link isLeafBlock} — a block holding other blocks. */
export function isContainerBlock(node: DocumentNode): boolean {
  return !isLeafBlock(node);
}

// ============================================================================
// Reading
// ============================================================================

/**
 * The node at `path`, or `null` if the path runs off the tree. An
 * empty path resolves to the document itself.
 */
export function nodeAt(
  doc: DocumentJSON,
  path: number[],
): DocumentNode | null {
  let node: DocumentNode = doc;
  for (const idx of path) {
    const children = node.content;
    if (!children || children[idx] === undefined) return null;
    node = children[idx];
  }
  return node;
}

/** The parent of the node at `path` (i.e. the node at `path` minus its last index). */
export function parentAt(
  doc: DocumentJSON,
  path: number[],
): DocumentNode | null {
  if (path.length === 0) return null;
  return nodeAt(doc, path.slice(0, -1));
}

/**
 * Descend from the node at `path` to its first leaf block, returning
 * the extended path. Used to normalise a selection that landed on a
 * container (e.g. a click that resolved to a table rather than a cell
 * paragraph). A path already at a leaf is returned unchanged.
 */
export function descendToLeafPath(
  doc: DocumentJSON,
  path: number[],
): number[] {
  const result = [...path];
  let node = nodeAt(doc, result);
  while (
    node &&
    isContainerBlock(node) &&
    node.content &&
    node.content.length > 0
  ) {
    result.push(0);
    node = node.content[0];
  }
  return result;
}

// ============================================================================
// Transforming
// ============================================================================

/**
 * Return a new document with the node at `path` replaced by
 * `fn(node)`. Nodes along the path are shallow-cloned; everything
 * else is shared. An out-of-range path returns the document
 * unchanged. An empty path replaces the root.
 */
export function mapNodeAt(
  doc: DocumentJSON,
  path: number[],
  fn: (node: DocumentNode) => DocumentNode,
): DocumentJSON {
  if (path.length === 0) {
    return fn(doc) as DocumentJSON;
  }
  const recurse = (node: DocumentNode, depth: number): DocumentNode => {
    const idx = path[depth];
    const children = node.content;
    if (!children || children[idx] === undefined) return node;
    const child = children[idx];
    const nextChild =
      depth === path.length - 1
        ? fn(child)
        : recurse(child, depth + 1);
    const nextContent = children.slice();
    nextContent[idx] = nextChild;
    return { ...node, content: nextContent };
  };
  return recurse(doc, 0) as DocumentJSON;
}

/**
 * Return a new document with the node at `path` removed from its
 * parent. An out-of-range path returns the document unchanged.
 */
export function removeNodeAt(
  doc: DocumentJSON,
  path: number[],
): DocumentJSON {
  if (path.length === 0) return doc;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  return mapNodeAt(doc, parentPath, (parent) => {
    const children = parent.content;
    if (!children || children[idx] === undefined) return parent;
    const next = children.slice();
    next.splice(idx, 1);
    return { ...parent, content: next };
  });
}

// ============================================================================
// Selection target
// ============================================================================

/**
 * Resolve the block a selection's anchor sits in, by path. Returns the
 * node and its path, or `null` if there's no selection or the path is
 * off-tree.
 *
 * This is the compatibility seam for the deep selection model. A
 * command that used to do `doc.content[sel.anchor.path[0]]` calls this
 * instead: with a top-level path it resolves the same top-level block
 * as before; with a deep path it resolves the leaf block inside a
 * table cell or list item. The command body — which then mutates
 * `node.content` — is otherwise unchanged.
 */
export function resolveSelectionTarget(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): { node: DocumentNode; path: number[] } | null {
  if (!selection) return null;
  const path = selection.anchor.path;
  const node = nodeAt(doc, path);
  if (!node) return null;
  return { node, path };
}

/**
 * Normalise a deep selection point. If the path resolves to a
 * container block (a table, a row, a list), the point came from a
 * click that landed on structure rather than editable text — descend
 * to the first leaf block and reset the offset to 0.
 *
 * A point already at a leaf, or one that resolves to nothing, is
 * returned unchanged.
 */
export function normalizeDeepPoint(
  doc: DocumentJSON,
  point: SelectionPoint,
): SelectionPoint {
  const node = nodeAt(doc, point.path);
  if (node && isContainerBlock(node)) {
    return { path: descendToLeafPath(doc, point.path), offset: 0 };
  }
  return point;
}
