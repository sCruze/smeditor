/**
 * Pure helpers for working with DocumentJSON.
 *
 * All functions are immutable: they return new document objects rather
 * than mutating the input. This keeps history snapshots safe and lets
 * us compare docs by reference for "did anything change?".
 */

import type {
  DocumentJSON,
  DocumentNode,
  EditorSelection,
  Mark,
} from "./types.js";
import { isLeafBlock } from "./path.js";
import {
  applyMarkToInlineRange,
  setMarkOnInlineRange,
  removeMarkFromInlineRange,
  splitInlineAt,
  visibleLength,
} from "./transform.js";

/** Deep clone any JSON-safe value. Faster than JSON.parse(JSON.stringify) for our shapes. */
export function cloneDoc<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => cloneDoc(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = cloneDoc(v);
  }
  return out as T;
}

/**
 * Returns true if the two docs are structurally equal.
 * Used to skip no-op transactions.
 */
export function docsEqual(a: DocumentJSON, b: DocumentJSON): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** An empty doc containing a single empty paragraph. */
export function emptyDocument(): DocumentJSON {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

/**
 * Concatenated plain text of a block's inline content. Used by the
 * input-rule engine to test regexes against "the text typed so far".
 */
export function getBlockText(block: DocumentNode): string {
  if (!block.content) return "";
  let out = "";
  for (const child of block.content) {
    if (child.type === "text") out += child.text ?? "";
  }
  return out;
}

/**
 * Remove the first `count` characters from a block's inline content,
 * mutating `block` in place. Marks on the surviving text are preserved
 * — only leading characters are dropped.
 *
 * This is what markdown input-rule handlers use to strip a typed
 * prefix like "## " before changing the block type.
 */
export function stripBlockPrefix(block: DocumentNode, count: number): void {
  if (!block.content || count <= 0) return;
  let remaining = count;
  const next: DocumentNode[] = [];
  for (const child of block.content) {
    if (remaining <= 0) {
      next.push(child);
      continue;
    }
    if (child.type === "text") {
      const text = child.text ?? "";
      if (text.length <= remaining) {
        // Whole node consumed by the prefix — drop it.
        remaining -= text.length;
      } else {
        next.push({ ...child, text: text.slice(remaining) });
        remaining = 0;
      }
    } else {
      // Non-text inline node — can't slice it, keep as-is.
      next.push(child);
    }
  }
  block.content = next;
}

/**
 * Walk every text node in the document, calling `visit` with its
 * containing block and index within that block.
 */
export function forEachTextNode(
  doc: DocumentJSON,
  visit: (
    text: DocumentNode,
    parentPath: number[],
    indexInParent: number,
  ) => void,
): void {
  const walk = (node: DocumentNode, path: number[]) => {
    if (!node.content) return;
    node.content.forEach((child, i) => {
      if (child.type === "text") {
        visit(child, path, i);
      } else {
        walk(child, [...path, i]);
      }
    });
  };
  walk(doc, []);
}

/** Whether a mark of a given type/attrs is present on a text node. */
export function hasMark(
  text: DocumentNode,
  type: string,
  attrs?: Record<string, unknown>,
): boolean {
  if (!text.marks) return false;
  return text.marks.some((m) => m.type === type && marksAttrsMatch(m, attrs));
}

function marksAttrsMatch(
  mark: Mark,
  attrs?: Record<string, unknown>,
): boolean {
  if (!attrs) return true;
  for (const [k, v] of Object.entries(attrs)) {
    if (mark.attrs?.[k] !== v) return false;
  }
  return true;
}

/**
 * Returns true if every text node touched by the selection has the
 * given mark — used to drive "is bold active?" toggle UI state.
 */
export function selectionHasMark(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  type: string,
  attrs?: Record<string, unknown>,
): boolean {
  if (!selection) return false;
  const ranges = leafRangesInSelection(doc, selection);
  const texts = ranges.flatMap(({ node, from, to }) =>
    textNodesInInlineRange(node.content ?? [], from, to),
  );
  if (texts.length === 0) return false;
  return texts.every((t) => hasMark(t, type, attrs));
}

/** Collect every text node intersecting the selection. */
export function textsInSelection(
  doc: DocumentJSON,
  selection: EditorSelection,
): DocumentNode[] {
  const result: DocumentNode[] = [];
  const { anchor, head } = selection;
  const start = comparePoints(anchor, head) <= 0 ? anchor : head;
  const end = start === anchor ? head : anchor;

  let started = false;
  let done = false;
  const walk = (node: DocumentNode, path: number[]) => {
    if (done) return;
    if (node.type === "text") {
      if (pathStartsWith(path.slice(0, -1), start.path) || started) {
        // Collect every text node in range. Finalise only after the end
        // block's children are exhausted (below), not on its first text
        // node — otherwise a block split into several inline runs (mixed
        // marks) dropped all but the first run.
        result.push(node);
        if (samePath(path.slice(0, -1), end.path) && start === end) {
          // Collapsed selection inside one text node — done immediately.
          done = true;
          return;
        }
        started = true;
      }
      return;
    }
    if (!node.content) return;
    node.content.forEach((child, i) => walk(child, [...path, i]));
    if (samePath(path, end.path)) done = true;
  };
  walk(doc, []);

  // Fallback: for collapsed selection that didn't yield anything, return
  // the text node directly under start.path (if any).
  if (result.length === 0) {
    const parent = nodeAtPath(doc, start.path);
    if (parent?.content) {
      for (const c of parent.content) {
        if (c.type === "text") result.push(c);
      }
    }
  }

  return result;
}

function comparePoints(
  a: { path: number[]; offset: number },
  b: { path: number[]; offset: number },
): number {
  const len = Math.min(a.path.length, b.path.length);
  for (let i = 0; i < len; i++) {
    if (a.path[i] !== b.path[i]) return a.path[i] - b.path[i];
  }
  if (a.path.length !== b.path.length) {
    return a.path.length - b.path.length;
  }
  return a.offset - b.offset;
}

function pathStartsWith(path: number[], prefix: number[]): boolean {
  if (path.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}

function samePath(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function nodeAtPath(
  doc: DocumentJSON,
  path: number[],
): DocumentNode | null {
  let node: DocumentNode = doc;
  for (const i of path) {
    if (!node.content || !node.content[i]) return null;
    node = node.content[i];
  }
  return node;
}

/**
 * Toggle a mark across the current selection.
 * Returns a new doc, or null if no change was needed.
 */
export function toggleMarkInDoc(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  type: string,
  attrs?: Record<string, unknown>,
): DocumentJSON | null {
  if (!selection) return null;

  const allHave = selectionHasMark(doc, selection, type, attrs);
  const mark: Mark = { type };
  if (attrs) mark.attrs = attrs;

  return editMarkAcrossSelection(doc, selection, (content, from, to) => {
    if (allHave) {
      return removeMatchingMarkFromInlineRange(content, from, to, type, attrs);
    }

    return applyMarkToInlineRange(content, from, to, mark);
  });
}

/**
 * Apply (or replace) a mark across exactly the selected range.
 *
 * This is the deep-, range-aware primitive that inline-formatting
 * extensions (text colour, background colour, highlight, font size,
 * font family) build on. Earlier those commands marked *every* text
 * node in the anchor block, so selecting one word coloured the whole
 * paragraph — this targets only the characters the user selected and
 * reaches into table cells / list items through the path.
 *
 * Behaviour:
 *  - a real range  → the mark is set on just that span, replacing any
 *    existing mark of the same type so colours/sizes swap cleanly;
 *  - a collapsed caret → the mark is applied to the whole block the
 *    caret sits in, so a toolbar click with no selection still does
 *    something predictable.
 *
 * Returns a new document, or null when nothing changed.
 */
export function setMarkAcrossSelection(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  mark: Mark,
): DocumentJSON | null {
  return editMarkAcrossSelection(doc, selection, (content, from, to) =>
    setMarkOnInlineRange(content, from, to, mark),
  );
}

/**
 * Remove every mark of `type` from the selected range (or the whole
 * block, for a collapsed caret). Counterpart to
 * {@link setMarkAcrossSelection}. Returns a new document, or null.
 */
export function unsetMarkAcrossSelection(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  type: string,
): DocumentJSON | null {
  return editMarkAcrossSelection(doc, selection, (content, from, to) =>
    removeMarkFromInlineRange(content, from, to, type),
  );
}

/**
 * Strip *every* mark from the text nodes inside the selected range
 * (or the whole block, for a collapsed caret). What the eraser
 * button does. Returns a new document, or null when nothing changed.
 */
export function clearMarksAcrossSelection(
  doc: DocumentJSON,
  selection: EditorSelection | null,
): DocumentJSON | null {
  return editMarkAcrossSelection(doc, selection, (content, from, to) => {
    // Reuse the offset-aware split machinery: cut [from, to) out,
    // drop marks on text nodes inside it, splice back.
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    if (hi <= lo) return content.slice();
    const [before, rest] = splitInlineAt(content, lo);
    const [middle, after] = splitInlineAt(rest, hi - lo);
    const cleaned = middle.map((n) => {
      if (n.type !== "text" || !n.marks) return n;
      const next: DocumentNode = { ...n };
      delete next.marks;
      return next;
    });
    return [...before, ...cleaned, ...after];
  });
}

/** Shared body for the mark-edit helpers above. */
function editMarkAcrossSelection(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  edit: (
    content: DocumentNode[],
    from: number,
    to: number,
  ) => DocumentNode[],
): DocumentJSON | null {
  if (!selection) return null;

  const newDoc = cloneDoc(doc);
  const ranges = leafRangesInSelection(newDoc, selection);
  if (ranges.length === 0) return null;

  let changed = false;
  for (const { node, from, to } of ranges) {
    const nextContent = edit(node.content ?? [], from, to);
    if (JSON.stringify(nextContent) !== JSON.stringify(node.content ?? [])) {
      node.content = nextContent;
      changed = true;
    }
  }
  return changed ? newDoc : null;
}

function leafRangesInSelection(
  doc: DocumentJSON,
  selection: EditorSelection,
): { path: number[]; node: DocumentNode; from: number; to: number }[] {
  const { anchor, head } = selection;
  const start = comparePoints(anchor, head) <= 0 ? anchor : head;
  const end = start === anchor ? head : anchor;
  const collapsed =
    samePath(start.path, end.path) && start.offset === end.offset;

  return leafBlocksInSelection(doc, selection)
    .map(({ path, node }) => {
      const len = inlineContentLength(node.content ?? []);
      let from: number;
      let to: number;

      if (collapsed) {
        from = 0;
        to = len;
      } else {
        const isStart = samePath(path, start.path);
        const isEnd = samePath(path, end.path);
        from = isStart ? Math.min(start.offset, len) : 0;
        to = isEnd ? Math.min(end.offset, len) : len;
      }

      return { path, node, from, to };
    })
    .filter(({ from, to }) => to > from);
}

function inlineContentLength(content: DocumentNode[]): number {
  // Use the same visible-width measure as splitInlineAt / setMarkOnInlineRange:
  // an atomic inline node (a mention pill) contributes its full label
  // length, not 1. Counting it as 1 clamped the selectable range short, so
  // mark commands silently skipped the text that followed a mention.
  return content.reduce((sum, node) => sum + visibleLength(node), 0);
}

function textNodesInInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
): DocumentNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (hi <= lo) return [];
  const [, rest] = splitInlineAt(content, lo);
  const [middle] = splitInlineAt(rest, hi - lo);
  return middle.filter((node) => node.type === "text");
}

function removeMatchingMarkFromInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
  type: string,
  attrs?: Record<string, unknown>,
): DocumentNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (hi <= lo) return content.slice();
  const [before, rest] = splitInlineAt(content, lo);
  const [middle, after] = splitInlineAt(rest, hi - lo);
  const cleaned = middle.map((node) => {
    if (node.type !== "text" || !node.marks) return node;
    const marks = node.marks.filter(
      (mark) => !(mark.type === type && marksAttrsMatch(mark, attrs)),
    );
    const next: DocumentNode = { ...node };
    if (marks.length) next.marks = marks;
    else delete next.marks;
    return next;
  });
  return [...before, ...cleaned, ...after];
}

/** Lexicographic comparison of two paths. */
function comparePath(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Every leaf block (paragraph, heading, …) the selection touches,
 * with its path. Works for both selection shapes: a top-level
 * selection yields the top-level blocks in range; a deep selection
 * yields the leaf blocks inside table cells / list items in range.
 *
 * This is the block-level counterpart to `textsInSelection` — block
 * commands resolve their targets through it instead of indexing
 * `path[0]`, which only ever sees the top level.
 */
export function leafBlocksInSelection(
  doc: DocumentJSON,
  selection: EditorSelection,
): { path: number[]; node: DocumentNode }[] {
  const { anchor, head } = selection;
  const a = comparePoints(anchor, head) <= 0 ? anchor : head;
  const b = a === anchor ? head : anchor;

  const leaves: { path: number[]; node: DocumentNode }[] = [];
  const walk = (node: DocumentNode, path: number[]) => {
    if (path.length > 0 && isLeafBlock(node)) {
      leaves.push({ path, node });
      return;
    }
    node.content?.forEach((child, i) => walk(child, [...path, i]));
  };
  walk(doc, []);

  return leaves.filter(
    (l) => isAtOrAfterBoundary(l.path, a.path) && isAtOrBeforeBoundary(l.path, b.path),
  );
}

/**
 * A leaf block should count as inside a selection boundary when it is
 * exactly at the boundary or nested under the selected container.
 * Example: after wrapping a paragraph in a blockquote, the retained
 * selection can be `{ path: [0] }` (the blockquote). The editable leaf is
 * `[0, 0]`; treating descendants as included lets alignment, colours and
 * other tools keep working immediately after the wrap command.
 */
function isAtOrAfterBoundary(path: number[], boundary: number[]): boolean {
  return comparePath(path, boundary) >= 0 || pathStartsWith(path, boundary);
}

function isAtOrBeforeBoundary(path: number[], boundary: number[]): boolean {
  return comparePath(path, boundary) <= 0 || pathStartsWith(path, boundary);
}

/**
 * Change the type (and attrs) of every block touched by the selection.
 * Used by commands like `setHeading({ level: 2 })` or `setParagraph()`.
 */
export function setBlockType(
  doc: DocumentJSON,
  selection: EditorSelection | null,
  type: string,
  attrs?: Record<string, unknown>,
): DocumentJSON | null {
  if (!selection) {
    // No selection — change the first block (sensible default for tests).
    if (!doc.content[0]) return null;
    const newDoc = cloneDoc(doc);
    newDoc.content[0].type = type;
    if (attrs) newDoc.content[0].attrs = { ...attrs };
    else delete newDoc.content[0].attrs;
    return newDoc;
  }

  const newDoc = cloneDoc(doc);
  // Resolve through leafBlocksInSelection so a deep selection retargets
  // the leaf block (a cell paragraph), not the top-level container.
  const leaves = leafBlocksInSelection(newDoc, selection);
  if (leaves.length === 0) return null;
  for (const { node } of leaves) {
    node.type = type;
    if (attrs) node.attrs = { ...attrs };
    else delete node.attrs;
  }
  return newDoc;
}
