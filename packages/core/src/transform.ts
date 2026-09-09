/**
 * Transform API — offset-aware document transforms.
 *
 * The selection model addresses a position as `{ path: [blockIndex],
 * offset }`, where `offset` is a count of *visible characters* into
 * the block — the same count `pointFromDOM` produces by summing the
 * `textContent` length of the DOM. A mention pill contributes the
 * length of its label text; a hard break contributes nothing.
 *
 * These functions operate on a block's inline content array. They're
 * pure — content in, new content out, no editor, no DOM — so they're
 * straightforward to test and to compose. Extensions (mentions,
 * comments) build their commands on them instead of hand-rolling
 * text-node surgery.
 */

import type { DocumentNode, DocumentJSON, Mark } from "./types.js";

// ============================================================================
// Measurement
// ============================================================================

/** Visible character length of one inline node (text, or nested text). */
export function visibleLength(node: DocumentNode): number {
  if (node.type === "text") return (node.text ?? "").length;
  if (node.content) {
    return node.content.reduce((sum, c) => sum + visibleLength(c), 0);
  }
  return 0;
}

/** Total visible character length of a block's inline content. */
export function inlineLength(block: DocumentNode): number {
  return (block.content ?? []).reduce((sum, n) => sum + visibleLength(n), 0);
}

/** The block's visible text, including text inside atomic nodes. */
export function blockVisibleText(block: DocumentNode): string {
  let out = "";
  const walk = (node: DocumentNode) => {
    if (node.type === "text") {
      out += node.text ?? "";
      return;
    }
    for (const c of node.content ?? []) walk(c);
  };
  for (const n of block.content ?? []) walk(n);
  return out;
}

// ============================================================================
// Core split
// ============================================================================

function withMarks(text: string, marks: Mark[] | undefined): DocumentNode {
  const node: DocumentNode = { type: "text", text };
  if (marks && marks.length) node.marks = marks;
  return node;
}

/**
 * Split an inline content array at `offset`, returning `[before,
 * after]`. A text node straddling the offset is cut in two, marks
 * preserved on both halves. An atomic node (mention) can't be cut —
 * it goes to whichever side its midpoint favours.
 */
export function splitInlineAt(
  content: DocumentNode[],
  offset: number,
): [DocumentNode[], DocumentNode[]] {
  const before: DocumentNode[] = [];
  const after: DocumentNode[] = [];
  let cur = 0;
  for (const node of content) {
    const len = visibleLength(node);
    if (cur >= offset) {
      after.push(node);
    } else if (cur + len <= offset) {
      before.push(node);
    } else if (node.type === "text") {
      const at = offset - cur;
      const txt = node.text ?? "";
      const left = txt.slice(0, at);
      const right = txt.slice(at);
      if (left) before.push(withMarks(left, node.marks));
      if (right) after.push(withMarks(right, node.marks));
    } else {
      // Atomic — assign whole to the nearer side.
      if (offset - cur <= len / 2) after.push(node);
      else before.push(node);
    }
    cur += len;
  }
  return [before, after];
}

// ============================================================================
// Inline edits
// ============================================================================

/** Insert `nodes` into a content array at `offset`. */
export function insertInlineAt(
  content: DocumentNode[],
  offset: number,
  nodes: DocumentNode[],
): DocumentNode[] {
  const [before, after] = splitInlineAt(content, offset);
  return [...before, ...nodes, ...after];
}

/** Delete the visible range `[from, to)` from a content array. */
export function deleteInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
): DocumentNode[] {
  if (to <= from) return content.slice();
  const [before] = splitInlineAt(content, from);
  const [, after] = splitInlineAt(content, to);
  return [...before, ...after];
}

/** Replace the visible range `[from, to)` with `nodes`. */
export function replaceInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
  nodes: DocumentNode[],
): DocumentNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const [before] = splitInlineAt(content, lo);
  const [, after] = splitInlineAt(content, hi);
  return [...before, ...nodes, ...after];
}

/**
 * Add `mark` to every text node in the visible range `[from, to)`.
 * Text straddling the range boundary is split so the mark applies
 * exactly to the selected span. A duplicate mark (same type + attrs)
 * is not added twice.
 */
export function applyMarkToInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
  mark: Mark,
): DocumentNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (hi <= lo) return content.slice();
  const [before, rest] = splitInlineAt(content, lo);
  const [middle, after] = splitInlineAt(rest, hi - lo);
  const key = mark.type + ":" + JSON.stringify(mark.attrs ?? {});
  const marked = middle.map((n) => {
    if (n.type !== "text") return n;
    const marks = n.marks ? [...n.marks] : [];
    const has = marks.some(
      (m) => m.type + ":" + JSON.stringify(m.attrs ?? {}) === key,
    );
    if (!has) marks.push(mark);
    return { ...n, marks };
  });
  return [...before, ...marked, ...after];
}

/**
 * Remove every mark of `type` from text nodes inside the visible
 * range `[from, to)`. Text straddling the boundary is split so the
 * removal applies exactly to the range. Marks outside the range are
 * untouched.
 */
export function removeMarkFromInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
  type: string,
): DocumentNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  if (hi <= lo) return content.slice();
  const [before, rest] = splitInlineAt(content, lo);
  const [middle, after] = splitInlineAt(rest, hi - lo);
  const cleaned = middle.map((n) => {
    if (n.type !== "text" || !n.marks) return n;
    const marks = n.marks.filter((m) => m.type !== type);
    const next: DocumentNode = { ...n };
    if (marks.length) next.marks = marks;
    else delete next.marks;
    return next;
  });
  return [...before, ...cleaned, ...after];
}

/**
 * Set `mark` on the visible range `[from, to)`, *replacing* any
 * existing mark of the same type that was already there. This is the
 * right primitive for single-valued marks (text color, font size,
 * …): applying a new colour swaps the old one instead of stacking a
 * second colour mark on the same text.
 */
export function setMarkOnInlineRange(
  content: DocumentNode[],
  from: number,
  to: number,
  mark: Mark,
): DocumentNode[] {
  const cleared = removeMarkFromInlineRange(content, from, to, mark.type);
  return applyMarkToInlineRange(cleared, from, to, mark);
}

// ============================================================================
// Block-level split
// ============================================================================

/**
 * Split the block at `blockIndex` into two at the given visible
 * `offset`, returning a new document. The second block keeps the
 * first's type and attributes. Out-of-range input returns the
 * document unchanged.
 */
export function splitBlock(
  doc: DocumentJSON,
  blockIndex: number,
  offset: number,
): DocumentJSON {
  const blocks = doc.content ?? [];
  const block = blocks[blockIndex];
  if (!block) return doc;
  const [before, after] = splitInlineAt(block.content ?? [], offset);
  const first: DocumentNode = { ...block, content: before };
  const second: DocumentNode = { ...block, content: after };
  const next = blocks.slice();
  next.splice(blockIndex, 1, first, second);
  return { ...doc, content: next };
}
