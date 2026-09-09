/**
 * @smeditor/extension-list-item
 *
 * The `<li>` node, plus caret-aware list behaviour (§13):
 *
 *   - Enter in a list item splits it into a new item, carrying any
 *     text after the caret into the new one.
 *   - Enter in an empty list item lifts out of the list — the item
 *     becomes a paragraph after the list.
 *   - Backspace at the start of an empty item does the same.
 *
 * These rely on the deep selection model: the caret's path runs
 * through the list and item nodes, so the commands can locate the
 * item to split or lift. With `deepSelection` off the path is a
 * single top-level index, the commands no-op, and the browser's
 * native Enter handles things — so this is additive, never a
 * regression.
 */

import type {
  Extension,
  EditorInstance,
  DocumentJSON,
  DocumentNode,
  EditorSelection,
} from "@smeditor/core";
import { nodeAt, splitInlineAt } from "@smeditor/core";

const ITEM_TYPES = new Set(["list_item", "task_item"]);

// ============================================================================
// Pure transforms — doc + selection in, new doc (+ caret) out
// ============================================================================

interface ListContext {
  itemPath: number[];
  item: DocumentNode;
  listPath: number[];
  itemIndex: number;
  /** Path of the leaf block (paragraph) the caret sits in. */
  leafPath: number[];
  leaf: DocumentNode;
  offset: number;
}

/** Resolve the list-item context around the selection's anchor, if any. */
function listContext(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): ListContext | null {
  if (!selection) return null;
  const leafPath = selection.anchor.path;
  // Need at least [..., list, item, leaf].
  if (leafPath.length < 2) return null;
  const itemPath = leafPath.slice(0, -1);
  const item = nodeAt(doc, itemPath);
  if (!item || !ITEM_TYPES.has(item.type)) return null;
  const leaf = nodeAt(doc, leafPath);
  if (!leaf) return null;
  return {
    itemPath,
    item,
    listPath: itemPath.slice(0, -1),
    itemIndex: itemPath[itemPath.length - 1],
    leafPath,
    leaf,
    offset: selection.anchor.offset,
  };
}

/** True if a leaf block has no visible text. */
function isEmptyLeaf(leaf: DocumentNode): boolean {
  const content = leaf.content ?? [];
  return content.every((n) => n.type === "text" && !(n.text ?? ""));
}

export interface ListItemResult {
  doc: DocumentJSON;
  caret: number[];
}

/**
 * Split the list item at the caret. Text before the caret stays in
 * the current item; text after moves to a new item inserted after
 * it. Returns the new document and the caret path (start of the new
 * item's leaf block), or null if the caret isn't in a list item.
 */
export function splitListItem(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): ListItemResult | null {
  const ctx = listContext(doc, selection);
  if (!ctx) return null;

  const [before, after] = splitInlineAt(ctx.leaf.content ?? [], ctx.offset);
  const list = nodeAt(doc, ctx.listPath);
  if (!list?.content) return null;

  const items = list.content.slice();
  // The leaf's index within the item — blocks before it stay in the old
  // item, blocks after it move to the new one. A list item holds `block+`,
  // so it may have several children (multiple paragraphs, nested sub-lists).
  const leafIdx = ctx.leafPath[ctx.leafPath.length - 1];
  const itemBlocks = ctx.item.content ?? [];
  const oldItem: DocumentNode = {
    ...ctx.item,
    content: [...itemBlocks.slice(0, leafIdx), { ...ctx.leaf, content: before }],
  };
  const newItem: DocumentNode = {
    type: ctx.item.type,
    content: [{ ...ctx.leaf, content: after }, ...itemBlocks.slice(leafIdx + 1)],
  };
  // A new task item starts unchecked.
  if (ctx.item.type === "task_item") newItem.attrs = { checked: false };
  items.splice(ctx.itemIndex, 1, oldItem, newItem);

  const newDoc = replaceNodeAt(doc, ctx.listPath, (l) => ({
    ...l,
    content: items,
  }));
  // Caret at the start of the new item's leaf block.
  const caret = [...ctx.listPath, ctx.itemIndex + 1, 0];
  return { doc: newDoc, caret };
}

/**
 * Lift the (empty) list item out of its list: the item is removed and
 * an empty paragraph is placed after the list, at the list's parent
 * level. If the list had only that item, the list is replaced by the
 * paragraph. Returns null if the caret isn't in a list item.
 */
export function liftListItem(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): ListItemResult | null {
  const ctx = listContext(doc, selection);
  if (!ctx) return null;
  // The list must itself sit inside something (doc, cell, blockquote).
  if (ctx.listPath.length < 1) return null;

  const listParentPath = ctx.listPath.slice(0, -1);
  const listIndex = ctx.listPath[ctx.listPath.length - 1];
  const list = nodeAt(doc, ctx.listPath);
  const remaining = (list?.content?.length ?? 0) - 1;

  const newDoc = replaceNodeAt(doc, listParentPath, (parent) => {
    const children = (parent.content ?? []).slice();
    const curList = children[listIndex];
    const items = (curList.content ?? []).slice();
    items.splice(ctx.itemIndex, 1);
    const emptyPara: DocumentNode = { type: "paragraph" };
    if (items.length === 0) {
      children.splice(listIndex, 1, emptyPara);
    } else {
      children.splice(listIndex, 1, { ...curList, content: items }, emptyPara);
    }
    return { ...parent, content: children };
  });

  // If the list survived, the paragraph follows it; else it took its place.
  const paraIndex = remaining > 0 ? listIndex + 1 : listIndex;
  return { doc: newDoc, caret: [...listParentPath, paraIndex] };
}

/**
 * Sink (nest) the current list item under the previous sibling, one
 * level deeper — the standard `Tab` behaviour. The item is appended to
 * a nested list inside the previous item: an existing trailing nested
 * list of the same kind is reused, otherwise a new one is created.
 * Returns null when the caret isn't in a list item or the item is the
 * first in its list (nothing to nest under).
 */
export function sinkListItem(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): ListItemResult | null {
  const ctx = listContext(doc, selection);
  if (!ctx) return null;
  if (ctx.itemIndex === 0) return null;

  const list = nodeAt(doc, ctx.listPath);
  if (!list?.content) return null;
  const listType = list.type;

  const items = list.content.slice();
  const current = items[ctx.itemIndex];
  const prev = items[ctx.itemIndex - 1];
  if (!current || !prev) return null;

  const prevContent = (prev.content ?? []).slice();
  const last = prevContent[prevContent.length - 1];
  let nestedIndex: number;
  let movedItemIndex: number;
  if (last && last.type === listType) {
    // Reuse the previous item's trailing nested list.
    const merged: DocumentNode = {
      ...last,
      content: [...(last.content ?? []), current],
    };
    prevContent[prevContent.length - 1] = merged;
    nestedIndex = prevContent.length - 1;
    movedItemIndex = (merged.content?.length ?? 1) - 1;
  } else {
    prevContent.push({ type: listType, content: [current] });
    nestedIndex = prevContent.length - 1;
    movedItemIndex = 0;
  }

  const newPrev: DocumentNode = { ...prev, content: prevContent };
  // Replace the previous item + current item with the merged previous item.
  items.splice(ctx.itemIndex - 1, 2, newPrev);

  const newDoc = replaceNodeAt(doc, ctx.listPath, (l) => ({
    ...l,
    content: items,
  }));
  // Caret stays in the same leaf, now nested one level deeper.
  const leafIdx = ctx.leafPath[ctx.leafPath.length - 1];
  const caret = [
    ...ctx.listPath,
    ctx.itemIndex - 1,
    nestedIndex,
    movedItemIndex,
    leafIdx,
  ];
  return { doc: newDoc, caret };
}

/** Immutable replace of the node at `path` (local copy of mapNodeAt). */
function replaceNodeAt(
  doc: DocumentJSON,
  path: number[],
  fn: (node: DocumentNode) => DocumentNode,
): DocumentJSON {
  if (path.length === 0) return fn(doc) as DocumentJSON;
  const recurse = (node: DocumentNode, depth: number): DocumentNode => {
    const idx = path[depth];
    const children = node.content;
    if (!children || children[idx] === undefined) return node;
    const next = children.slice();
    next[idx] =
      depth === path.length - 1
        ? fn(children[idx])
        : recurse(children[idx], depth + 1);
    return { ...node, content: next };
  };
  return recurse(doc, 0) as DocumentJSON;
}

// ============================================================================
// Extension
// ============================================================================

function caretSelection(path: number[]): EditorSelection {
  return {
    anchor: { path, offset: 0 },
    head: { path, offset: 0 },
  };
}

export const ListItemExtension: Extension = {
  name: "list_item",
  nodes: [
    {
      name: "list_item",
      group: "block",
      content: "block+",
      toDOM: () => ["li", 0],
      parseDOM: [{ tag: "li" }],
    },
  ],
  commands: {
    /** Split the current list item at the caret (Enter behaviour). */
    splitListItem:
      () =>
      (editor: EditorInstance): boolean => {
        const result = splitListItem(editor.getJSON(), editor.getSelection());
        if (!result) return false;
        editor.dispatch({
          doc: result.doc,
          selection: caretSelection(result.caret),
          addToHistory: true,
        });
        return true;
      },
    /** Lift the current (empty) list item out of its list. */
    liftListItem:
      () =>
      (editor: EditorInstance): boolean => {
        const result = liftListItem(editor.getJSON(), editor.getSelection());
        if (!result) return false;
        editor.dispatch({
          doc: result.doc,
          selection: caretSelection(result.caret),
          addToHistory: true,
        });
        return true;
      },
    /** Nest the current list item under the previous one (Tab behaviour). */
    sinkListItem:
      () =>
      (editor: EditorInstance): boolean => {
        const result = sinkListItem(editor.getJSON(), editor.getSelection());
        if (!result) return false;
        editor.dispatch({
          doc: result.doc,
          selection: caretSelection(result.caret),
          addToHistory: true,
        });
        return true;
      },
  },
  keyboardShortcuts: {
    // Tab nests the current item under the previous one. When it can't
    // (first item / not in a list) it returns false so a later
    // extension — table cell navigation or block indent — handles Tab.
    Tab: (editor: EditorInstance): boolean =>
      editor.commands.sinkListItem?.() ?? false,
    Enter: (editor: EditorInstance): boolean => {
      const ctx = listContext(editor.getJSON(), editor.getSelection());
      if (!ctx) return false;
      // An empty item lifts out; a non-empty one splits.
      if (isEmptyLeaf(ctx.leaf)) {
        return editor.commands.liftListItem?.() ?? false;
      }
      return editor.commands.splitListItem?.() ?? false;
    },
    Backspace: (editor: EditorInstance): boolean => {
      const ctx = listContext(editor.getJSON(), editor.getSelection());
      // Only act at the very start of an empty item — otherwise let
      // the browser delete a character normally.
      if (!ctx || ctx.offset !== 0 || !isEmptyLeaf(ctx.leaf)) return false;
      return editor.commands.liftListItem?.() ?? false;
    },
  },
};

export default ListItemExtension;
