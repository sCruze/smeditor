/**
 * Block-level operations.
 *
 * Built on top of doc-utils. Lives in a separate module so the basic
 * mark/setBlockType helpers stay small and easy to read.
 *
 * All operations are immutable — they return a new document or null
 * if no change was needed.
 */

import type {
  DocumentJSON,
  DocumentNode,
  EditorSelection,
} from "./types.js";
import { cloneDoc, leafBlocksInSelection } from "./doc-utils.js";
import { nodeAt, mapNodeAt } from "./path.js";

/**
 * Index range of top-level blocks touched by the selection.
 * Returns [start, end] inclusive. Null when no selection.
 */
export function selectionBlockRange(
  selection: EditorSelection | null,
): [number, number] | null {
  if (!selection) return null;
  const a = selection.anchor.path[0] ?? 0;
  const b = selection.head.path[0] ?? a;
  return a <= b ? [a, b] : [b, a];
}

interface SiblingRange {
  parentPath: number[];
  start: number;
  end: number;
}

function samePath(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function selectionSiblingRange(
  selection: EditorSelection | null,
): SiblingRange | null {
  if (!selection) return null;
  const anchorPath = selection.anchor.path;
  const headPath = selection.head.path;
  if (anchorPath.length === 0 || headPath.length === 0) return null;

  const anchorParent = anchorPath.slice(0, -1);
  const headParent = headPath.slice(0, -1);
  if (!samePath(anchorParent, headParent)) {
    const range = selectionBlockRange(selection);
    return range ? { parentPath: [], start: range[0], end: range[1] } : null;
  }

  const a = anchorPath[anchorPath.length - 1];
  const b = headPath[headPath.length - 1];
  return {
    parentPath: anchorParent,
    start: Math.min(a, b),
    end: Math.max(a, b),
  };
}

function replaceChildrenAt(
  doc: DocumentJSON,
  parentPath: number[],
  fn: (children: DocumentNode[]) => DocumentNode[],
): DocumentJSON | null {
  const parent = nodeAt(doc, parentPath);
  if (!parent?.content) return null;

  const newDoc = cloneDoc(doc);
  const nextDoc = mapNodeAt(newDoc, parentPath, (node) => {
    const children = node.content ?? [];
    return { ...node, content: fn(children.slice()) };
  });
  return nextDoc;
}

function closestWrapperPath(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  wrapperType: string,
): number[] | null {
  if (!selection) return null;
  const path = selection.anchor.path;
  for (let depth = path.length; depth >= 1; depth--) {
    const currentPath = path.slice(0, depth);
    const node = nodeAt(doc, currentPath);
    if (node?.type === wrapperType) return currentPath;
  }
  return null;
}

/**
 * Wrap each touched sibling block in a parent node of `wrapperType`.
 * If `itemType` is given, each block is first wrapped in `itemType`
 * (used for lists: paragraph → list_item → bullet_list).
 *
 * Consecutive wraps of the same `wrapperType` merge into one wrapper,
 * which is what users intuitively expect when they toggle "list" on
 * three adjacent paragraphs.
 *
 * Deep selections are scoped to their immediate parent container, so
 * toggling a list inside a blockquote, table cell or list item changes
 * that nested content instead of wrapping the top-level container.
 */
export function wrapBlocks(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  wrapperType: string,
  itemType?: string,
  wrapperAttrs?: Record<string, unknown>,
): DocumentJSON | null {
  let range = selectionSiblingRange(selection);
  if (!range) {
    // A real but unresolvable selection (malformed/empty paths) bails.
    // With no selection at all — common in headless usage and before
    // the caret is established — default to the first top-level block so
    // toggling a blockquote / list still does something predictable,
    // matching `setBlockType`'s no-selection behaviour.
    if (selection) return null;
    range = { parentPath: [], start: 0, end: 0 };
  }
  const { parentPath, start, end } = range;
  const parent = nodeAt(doc, parentPath);
  if (!parent?.content) return null;

  const items: DocumentNode[] = [];
  for (let i = start; i <= end; i++) {
    const block = parent.content[i];
    if (!block) continue;
    const clonedBlock = cloneDoc(block);
    if (itemType) {
      items.push({ type: itemType, content: [clonedBlock] });
    } else {
      items.push(clonedBlock);
    }
  }
  if (items.length === 0) return null;

  const wrapper: DocumentNode = { type: wrapperType, content: items };
  if (wrapperAttrs) wrapper.attrs = { ...wrapperAttrs };

  return replaceChildrenAt(doc, parentPath, (children) => {
    children.splice(start, end - start + 1, wrapper);
    return children;
  });
}

/**
 * Unwrap a wrapper node at the given top-level index, hoisting its
 * children up to the document root. If `unwrapItemToo` is true, also
 * peel each child once more (used for lists: bullet_list > list_item
 * > paragraph → paragraph).
 */
export function unwrapBlock(
  doc: DocumentJSON,
  blockIndex: number,
  unwrapItemToo = false,
): DocumentJSON | null {
  return unwrapBlockAtPath(doc, [blockIndex], unwrapItemToo);
}

function unwrapBlockAtPath(
  doc: DocumentJSON,
  path: number[],
  unwrapItemToo = false,
): DocumentJSON | null {
  if (path.length === 0) return null;
  const wrapper = nodeAt(doc, path);
  if (!wrapper?.content) return null;

  let hoisted: DocumentNode[] = cloneDoc(wrapper.content);
  if (unwrapItemToo) {
    hoisted = hoisted.flatMap((item) => item.content ?? []);
  }
  if (hoisted.length === 0) {
    hoisted = [{ type: "paragraph", content: [] }];
  }

  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return replaceChildrenAt(doc, parentPath, (children) => {
    if (!children[index]) return children;
    children.splice(index, 1, ...hoisted);
    return children;
  });
}

/**
 * Toggle a wrapper around the selected blocks.
 *
 *  - If every touched block is already inside a wrapper of `wrapperType`,
 *    unwrap it (turning list back into paragraphs, etc.).
 *  - Otherwise, wrap the selection in a new wrapper of that type.
 *
 * For nested structures (list_item) caller passes `itemType`.
 */
export function toggleWrap(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  wrapperType: string,
  itemType?: string,
  wrapperAttrs?: Record<string, unknown>,
): DocumentJSON | null {
  const wrapperPath = closestWrapperPath(doc, selection, wrapperType);
  if (wrapperPath) {
    return unwrapBlockAtPath(doc, wrapperPath, Boolean(itemType));
  }
  return wrapBlocks(doc, selection, wrapperType, itemType, wrapperAttrs);
}

/**
 * Whether the selection lives inside a wrapper of `wrapperType`.
 * Used by toolbar buttons to compute `aria-pressed`.
 */
export function selectionInsideWrapper(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  wrapperType: string,
): boolean {
  if (!selection) return false;
  const path = selection.anchor.path;

  // Deep selections can sit several levels down (table → row → cell →
  // blockquote → paragraph). Walk the ancestor chain instead of only
  // checking the top-level block so wrapper-aware toolbar states and
  // toggles keep working in nested content.
  for (let depth = path.length; depth >= 1; depth--) {
    const node = nodeAt(doc, path.slice(0, depth));
    if (node?.type === wrapperType) return true;
  }

  const range = selectionBlockRange(selection);
  if (!range) return false;
  const [start] = range;
  return doc.content[start]?.type === wrapperType;
}

/**
 * Merge a partial attrs object into every *leaf* block touched by the
 * selection. Existing attrs are preserved; only the listed keys are
 * overwritten. Passing `null` for a key removes it.
 *
 * Deep-aware: a selection inside a blockquote, table cell or list
 * item resolves to the leaf paragraph/heading there, not the
 * top-level container — so alignment, line height and indentation
 * actually land on the text the user sees.
 *
 * Used by extensions like text-align and line-height that decorate
 * existing blocks without replacing them.
 */
export function setBlockAttrs(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  patch: Record<string, unknown>,
): DocumentJSON | null {
  if (!selection) return null;
  const newDoc = cloneDoc(doc);
  const leaves = leafBlocksInSelection(newDoc, selection);
  if (leaves.length === 0) return null;
  let changed = false;
  for (const { node: block } of leaves) {
    const next = { ...(block.attrs ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) {
        delete next[k];
      } else {
        next[k] = v;
      }
    }
    if (Object.keys(next).length === 0) {
      delete block.attrs;
    } else {
      block.attrs = next;
    }
    changed = true;
  }
  return changed ? newDoc : null;
}

/**
 * Read a single attribute from the first *leaf* block touched by the
 * selection. Returns null if the selection or the attribute is absent.
 */
export function getBlockAttr(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  key: string,
): unknown {
  if (!selection) return null;
  const leaves = leafBlocksInSelection(doc, selection);
  return leaves[0]?.node.attrs?.[key] ?? null;
}
